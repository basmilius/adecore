import { useTranslation } from 'react-i18next';
import { PromptDialog } from '@adecore/ui';
import { dialectOf } from '../ddl/index.ts';
import { useDatabaseClient } from '../client-context.ts';
import type { Connection, TableRef } from '../client/types.ts';
import type { TableKind } from '../protocol/index.ts';
import { statementOf, type TableChange } from './table-statements.ts';

export interface TableRequest {
    readonly change: TableChange;
    readonly connection: Connection;
    readonly ref: TableRef;
    readonly kind: TableKind;
}

export interface TableDialogProps {
    request: TableRequest;
    onClose(): void;
    /* After the statement ran; `to` is the new name of a rename. */
    onDone(request: TableRequest, to: string | undefined): void;
}

/* The question behind Rename, Truncate and Drop: it runs the statement, keeps a failure in the dialog and sees to it that the listeners hear the shape changed. */
export function TableDialog({ request, onClose, onDone }: TableDialogProps) {
    const { t } = useTranslation('database');
    const client = useDatabaseClient();
    const { change, connection, ref, kind } = request;
    const words = change === 'drop' ? `explorer.drop.${kind === 'view' ? 'view' : 'table'}` : `explorer.${change}`;

    const run = async (to?: string): Promise<void> => {
        const session = client.session(connection);
        const dialect = dialectOf(await session.server());
        const { results } = await session.execute(statementOf(dialect, change, ref, kind, to));
        const failed = results.find((result) => result.kind === 'error');
        if (failed !== undefined && failed.kind === 'error') {
            throw new Error(failed.error.message);
        }
        // The client tells its listeners after a `RENAME`, a `DROP` and a `TRUNCATE`, but not after a SQLite emptying, which is a `DELETE FROM`.
        if (change === 'truncate' && dialect.engine === 'sqlite') {
            client.notifySchemaChange({ connectionId: ref.connectionId, schema: ref.schema });
        }
        onDone(request, to);
    };

    const confirm = async (typed: string): Promise<void> => {
        if (change === 'rename') {
            if (typed === ref.table) {
                onClose();
                return;
            }
            await run(typed);
        } else if (change === 'drop') {
            if (typed !== ref.table) {
                throw new Error(t('explorer.drop.mismatch'));
            }
            await run();
        } else {
            await run();
        }
    };

    return (
        <PromptDialog
            open
            danger={change !== 'rename'}
            title={t(`${words}.title`, { name: ref.table })}
            description={change === 'rename' ? undefined : t(`${words}.description`, { name: ref.table })}
            field={
                change === 'truncate'
                    ? undefined
                    : change === 'rename'
                      ? { label: t('explorer.rename.field'), initial: ref.table, mono: true }
                      : { label: t('explorer.drop.field', { name: ref.table }), placeholder: ref.table, mono: true }
            }
            confirmLabel={t(`${words}.confirm`)}
            onConfirm={confirm}
            onOpenChange={onClose}
        />
    );
}
