import { useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { CircleAlert, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Spinner, messageOf } from '@adecore/ui';
import { useDatabaseAction, useDatabaseClient } from '../client-context.ts';
import type { Connection, ExecuteResult } from '../client/types.ts';
import { dialectOf, draftOf, emptyDraft, type Dialect, type TableDraft } from '../ddl/index.ts';
import type { TableStructure } from '../protocol/index.ts';
import { useLoaded } from '../table/useLoaded.ts';
import { useSchemaChange } from '../use-schema-change.ts';
import { DesignerView } from './DesignerView.tsx';
import { planOf } from './plan.ts';
import { recoverFrom } from './recover.ts';
import { useReferenceColumns } from './useReferenceColumns.ts';

export interface TableDesignerProps {
    connection: Connection;
    schema: string;
    /* The table to modify; without one the designer makes a new table. */
    table?: string;
    /* The app's own content at the start of the toolbar, before the name of the table, such as where it is. */
    toolbarStart?: ReactNode;
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

/* Creates a table or modifies one: its columns, indexes, foreign keys and options, with the SQL it will run shown before it runs. */
export function TableDesigner({ connection, schema, table, toolbarStart, className, ref }: TableDesignerProps) {
    const { t } = useTranslation('database');
    const client = useDatabaseClient();
    const onAction = useDatabaseAction();
    const [subject, setSubject] = useState({ requested: table, current: table ?? null });
    const [editing, setEditing] = useState<Editing>({ snapshot: null, baseline: emptyDraft(), draft: emptyDraft() });
    const [confirming, setConfirming] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const [shapeChanged, setShapeChanged] = useState(false);
    const applying = useRef(false);

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

    // The apply of this designer reloads by itself; a change from elsewhere replaces an untouched draft and warns about an edited one.
    useSchemaChange(connection.id, schema, () => {
        if (applying.current) {
            return;
        }

        if (editing.draft === editing.baseline) {
            loaded.reload();
        } else {
            setShapeChanged(true);
        }
    });

    // A new snapshot, after a load or an apply, starts a fresh draft.
    if (snapshot !== null && editing.snapshot !== snapshot) {
        const baseline = snapshot.structure === null ? emptyDraft() : draftOf(snapshot.structure);
        setEditing({ snapshot, baseline, draft: baseline });
        setShapeChanged(false);
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
        const settle = (message: string | null): void => {
            setFailure(message);
            setConfirming(false);
        };
        let outcome: ExecuteResult;
        applying.current = true;
        try {
            outcome = await session.execute(statements.join(';\n'), { schema });
        } catch (e) {
            settle(messageOf(e, t('designer.failed')));
            return;
        } finally {
            applying.current = false;
        }
        const failed = outcome.results.find((result) => result.kind === 'error');
        if (failed?.kind === 'error') {
            await recoverFrom(session, statements, failed.sql, outcome.inTransaction);
            settle(failed.error.message);
            return;
        }
        settle(null);
        // The client has told its listeners already: `execute` does for a statement that creates, alters or drops.
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
            {shapeChanged && (
                <div className="shrink-0 px-3 pt-3">
                    <Banner icon={RefreshCw} tone="neutral" className="w-full" message={t('designer.changed')}>
                        <Button variant="secondary" size="sm" onClick={loaded.reload}>
                            {t('designer.reload')}
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
                    toolbarStart={toolbarStart}
                />
            )}
        </div>
    );
}
