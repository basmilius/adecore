import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMenu, copyText } from '@adecore/ui';
import type { DatabaseAction } from '../actions.ts';
import { useDatabaseAction, useDatabaseClient } from '../client-context.ts';
import type { Connection, TableRef } from '../client/types.ts';
import type { TableKind } from '../protocol/index.ts';
import type { TableRequest } from './TableDialog.tsx';
import { selectAllSql, type LoadTarget, type TreeRow } from './tree.ts';

export interface RowMenuProps {
    row: TreeRow;
    connection: Connection;
    onRefresh(target: LoadTarget): void;
    onDisconnect(connection: Connection): void;
    onRequest(request: TableRequest): void;
}

/* The items of a row's context menu. An item whose action has nowhere to go, or that writes to a read only connection, is left out. */
export function RowMenu({ row, connection, onRefresh, onDisconnect, onRequest }: RowMenuProps) {
    const { t } = useTranslation('database');
    const client = useDatabaseClient();
    const act = useDatabaseAction();
    const writable = connection.config.readOnly !== true;

    const consoleAction = (schema?: string, sql?: string): DatabaseAction => ({
        kind: 'open-console',
        connectionId: connection.id,
        ...(schema === undefined ? {} : { schema }),
        ...(sql === undefined ? {} : { sql })
    });

    const copyDdl = async (ref: TableRef): Promise<void> => {
        const structure = await client.session(connection).structure(ref.schema, ref.table);
        if (structure.ddl !== null) {
            copyText(structure.ddl);
        }
    };

    const item = (key: string, label: string, onClick: () => void): ReactNode => (
        <ContextMenu.Item key={key} onClick={onClick}>
            {label}
        </ContextMenu.Item>
    );

    const actionItem = (key: string, label: string, action: DatabaseAction): ReactNode => (act === undefined ? null : item(key, label, () => act(action)));

    const tableGroups = (ref: TableRef, kind: TableKind): ReactNode[][] => {
        const request = (change: TableRequest['change']) => (): void => onRequest({ change, connection, ref, kind });
        return [
            [
                actionItem('open-data', t('explorer.openData'), { kind: 'open-table', ref, view: 'data' }),
                actionItem('open-structure', t('explorer.openStructure'), { kind: 'open-table', ref, view: 'structure' }),
                kind === 'table' && writable ? actionItem('edit-table', t('explorer.editTable'), { kind: 'edit-table', ref }) : null,
                actionItem('console', t('explorer.newConsoleHere'), consoleAction(ref.schema, selectAllSql(connection.config.engine, ref)))
            ],
            [
                item('copy-name', t('explorer.copyName'), () => copyText(ref.table)),
                item('copy-ddl', t('explorer.copyDdl'), () => void copyDdl(ref).catch(() => undefined))
            ],
            writable
                ? [
                      kind === 'table' ? item('rename', t('explorer.rename.action'), request('rename')) : null,
                      kind === 'table' ? item('truncate', t('explorer.truncate.action'), request('truncate')) : null,
                      item('drop', t(kind === 'view' ? 'explorer.drop.view.action' : 'explorer.drop.table.action'), request('drop'))
                  ]
                : []
        ];
    };

    const groupsOf = (): ReactNode[][] => {
        switch (row.kind) {
            case 'connection':
                return [
                    [
                        actionItem('console', t('explorer.newConsole'), consoleAction()),
                        item('refresh', t('explorer.refresh'), () => onRefresh({ connectionId: connection.id })),
                        actionItem('manage', t('explorer.editConnection'), { kind: 'manage-connection', connectionId: connection.id })
                    ],
                    [item('disconnect', t('explorer.disconnect'), () => onDisconnect(connection))]
                ];
            case 'schema':
            case 'folder':
                return [
                    [
                        writable
                            ? actionItem('new-table', t('explorer.newTable'), { kind: 'new-table', connectionId: connection.id, schema: row.schema })
                            : null,
                        actionItem('console', t('explorer.newConsoleHere'), consoleAction(row.schema)),
                        item('refresh', t('explorer.refresh'), () => onRefresh({ connectionId: connection.id, schema: row.schema }))
                    ]
                ];
            case 'table':
                return tableGroups(row.ref, row.table.kind);
            case 'column':
                return [
                    [
                        actionItem('open-data', t('explorer.open'), { kind: 'open-table', ref: row.ref, view: 'data' }),
                        item('copy-name', t('explorer.copyName'), () => copyText(row.column.name))
                    ]
                ];
            default:
                return [];
        }
    };

    const groups = groupsOf()
        .map((items) => items.filter((entry) => entry !== null))
        .filter((items) => items.length > 0);

    return groups.map((items, i) => (
        <Fragment key={i}>
            {i > 0 && <ContextMenu.Separator />}
            {items}
        </Fragment>
    ));
}
