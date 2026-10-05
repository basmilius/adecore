import { useMemo, useState, type Ref } from 'react';
import clsx from 'clsx';
import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Spinner, messageOf } from '@adecore/ui';
import { useDatabaseAction, useDatabaseClient } from '../client-context.ts';
import type { Connection, DatabaseSession, ExecuteResult } from '../client/types.ts';
import { dialectOf, draftOf, emptyDraft, type Dialect, type TableDraft } from '../ddl/index.ts';
import type { TableStructure } from '../protocol/index.ts';
import { useLoaded } from '../table/useLoaded.ts';
import { DesignerView } from './DesignerView.tsx';
import { planOf } from './plan.ts';
import { useReferenceColumns } from './useReferenceColumns.ts';

export interface TableDesignerProps {
    connection: Connection;
    schema: string;
    /* The table to modify; without one the designer makes a new table. */
    table?: string;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* What the designer starts from. */
interface Snapshot {
    readonly dialect: Dialect;
    /* `null` for a table that does not exist yet. */
    readonly structure: TableStructure | null;
    readonly tables: readonly string[];
}

interface Editing {
    readonly snapshot: Snapshot | null;
    /* The draft Revert goes back to; the draft is this very object until something is edited. */
    readonly baseline: TableDraft;
    readonly draft: TableDraft;
}

const REBUILD_START = 'PRAGMA foreign_keys=OFF';

/*
 * A failed rebuild leaves SQLite with a transaction it began and foreign keys it switched off.
 * Only a transaction this script began is rolled back, since one the person had open is theirs.
 */
async function recoverFrom(session: DatabaseSession, statements: readonly string[], failedSql: string, inTransaction: boolean): Promise<void> {
    try {
        if (inTransaction && statements.includes('BEGIN') && failedSql.trim().toUpperCase() !== 'BEGIN') {
            await session.transaction('rollback');
        }
        if (statements[0] === REBUILD_START) {
            await session.execute('PRAGMA foreign_keys=ON');
        }
    } catch {
        // The error of the statement that failed is the one worth showing.
    }
}

/* Creates a table or modifies one: its columns, indexes, foreign keys and options, with the SQL it will run shown before it runs. */
export function TableDesigner({ connection, schema, table, className, ref }: TableDesignerProps) {
    const { t } = useTranslation('database');
    const client = useDatabaseClient();
    const onAction = useDatabaseAction();
    const [subject, setSubject] = useState({ requested: table, current: table ?? null });
    const [editing, setEditing] = useState<Editing>({ snapshot: null, baseline: emptyDraft(), draft: emptyDraft() });
    const [confirming, setConfirming] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);

    if (subject.requested !== table) {
        setSubject({ requested: table, current: table ?? null });
    }

    const loaded = useLoaded<Snapshot>(
        async (signal) => {
            const session = client.session(connection);
            const [server, structure, tables] = await Promise.all([
                session.server({ signal }),
                subject.current === null ? Promise.resolve(null) : session.structure(schema, subject.current, { signal }),
                session.tables(schema, { signal })
            ]);
            return { dialect: dialectOf(server), structure, tables: tables.filter((info) => info.kind === 'table').map((info) => info.name) };
        },
        JSON.stringify([connection.id, schema, subject.current])
    );
    const snapshot = loaded.value;

    // A new snapshot, after a load or an apply, starts a fresh draft.
    if (snapshot !== null && editing.snapshot !== snapshot) {
        const baseline = snapshot.structure === null ? emptyDraft() : draftOf(snapshot.structure);
        setEditing({ snapshot, baseline, draft: baseline });
    }
    const draft = editing.draft;

    const plan = useMemo(() => (snapshot === null ? null : planOf(snapshot.dialect, schema, snapshot.structure, draft)), [snapshot, schema, draft]);
    const referenceColumns = useReferenceColumns(client, connection, schema, draft);

    const readOnlyReason =
        connection.config.readOnly === true ? t('designer.readOnly.connection') : snapshot?.structure?.kind === 'view' ? t('designer.readOnly.view') : null;

    async function apply(): Promise<void> {
        if (snapshot === null || plan === null) {
            return;
        }
        const session = client.session(connection);
        const statements = plan.statements;
        const wasNew = snapshot.structure === null;
        let outcome: ExecuteResult;
        try {
            outcome = await session.execute(statements.join(';\n'), { schema });
        } catch (e) {
            setFailure(messageOf(e, t('designer.failed')));
            setConfirming(false);
            return;
        }
        const failed = outcome.results.find((result) => result.kind === 'error');
        if (failed?.kind === 'error') {
            await recoverFrom(session, statements, failed.sql, outcome.inTransaction);
            setFailure(failed.error.message);
            setConfirming(false);
            return;
        }
        setFailure(null);
        setConfirming(false);
        client.notifySchemaChange({ connectionId: connection.id, schema });
        if (wasNew || draft.name !== draft.originalName) {
            setSubject({ requested: table, current: draft.name });
            onAction?.({ kind: 'edit-table', ref: { connectionId: connection.id, schema, table: draft.name } });
        } else {
            loaded.reload();
        }
    }

    return (
        <div ref={ref} className={clsx('flex min-h-0 min-w-0 flex-col', className)}>
            {(loaded.loading || snapshot === null) && loaded.error === null && (
                <div className="grid grow place-items-center py-8 text-text-muted">
                    <Spinner size={20} label={t('designer.loading')} />
                </div>
            )}
            {loaded.error !== null && snapshot === null && (
                <div className="p-3">
                    <Banner icon={CircleAlert} tone="error" className="w-full" message={loaded.error}>
                        <Button variant="secondary" size="sm" onClick={loaded.reload}>
                            {t('designer.retry')}
                        </Button>
                    </Banner>
                </div>
            )}
            {!loaded.loading && snapshot !== null && plan !== null && (
                <DesignerView
                    className="grow"
                    dialect={snapshot.dialect}
                    schema={schema}
                    draft={draft}
                    isNew={snapshot.structure === null}
                    changed={draft !== editing.baseline}
                    tables={snapshot.tables}
                    plan={plan}
                    readOnlyReason={readOnlyReason}
                    failure={failure}
                    confirming={confirming}
                    referenceColumns={referenceColumns}
                    onChange={(next) => setEditing({ ...editing, draft: next })}
                    onRequestApply={() => setConfirming(true)}
                    onConfirm={apply}
                    onCancelConfirm={() => setConfirming(false)}
                    onRevert={() => {
                        setEditing({ ...editing, draft: editing.baseline });
                        setFailure(null);
                    }}
                    onDismissFailure={() => setFailure(null)}
                />
            )}
        </div>
    );
}
