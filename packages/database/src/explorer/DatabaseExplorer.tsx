import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { CircleAlert, Columns2, Database, Eye, Folder, KeyRound, ListOrdered, Lock, Search, ShieldCheck, Table, Zap, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, ContextMenu, EmptyState, Icon, Input, Spinner, Tooltip, Tree } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import type { ExplorerSelection } from '../actions.ts';
import { useDatabaseAction, useDatabaseClient } from '../client-context.ts';
import type { Connection } from '../client/types.ts';
import { EngineIcon } from '../connections/EngineIcon.tsx';
import { keyLabelOf, type ColumnKeys } from '../column-keys.ts';
import { KeyIcon } from '../KeyIcon.tsx';
import type { ExplorerFolder } from './folders.ts';
import { RowMenu } from './RowMenu.tsx';
import { TableDialog, type TableRequest } from './TableDialog.tsx';
import {
    connectionKey,
    flattenTree,
    hasMenu,
    isExpandable,
    startsOpen,
    isSelectable,
    navigate,
    neededLoads,
    selectionKey,
    selectionOf,
    tabStop,
    openedTableOf,
    tableKindIn,
    tableOf,
    type EntryRow,
    type ErrorRow,
    type LoadTarget,
    type ExpandableRow,
    type TreeRow
} from './tree.ts';
import { useExplorerLoads } from './use-explorer-loads.ts';
import { usePopupPress } from '../use-popup-press.ts';
import { useStoredExpansion } from './use-stored-expansion.ts';

export interface DatabaseExplorerProps {
    connections: readonly Connection[];
    /* The selected connection, schema or table. Without it the explorer keeps the selection itself, starting at `defaultValue`. */
    value?: ExplorerSelection | null;
    defaultValue?: ExplorerSelection | null;
    onValueChange?(selection: ExplorerSelection | null): void;
    showSystemSchemas?: boolean;
    /* Opens a table on a click too, with `preview: true`; a double click or Enter then sends `preview: false`. */
    openOnClick?: boolean;
    /* The app's own folders under each connection, by connection id, after its schemas. */
    folders?: Readonly<Record<string, readonly ExplorerFolder[]>>;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/*
 * The connections, their schemas and their tables as a tree, loaded as each node opens. Every row
 * selects; a double click or Enter on a table asks the app to open it through `useDatabaseAction`,
 * and on an item of a folder the app added opens it through the item's own `onOpen`.
 */
export function DatabaseExplorer({
    connections,
    value,
    defaultValue = null,
    onValueChange,
    showSystemSchemas = false,
    openOnClick = false,
    folders,
    className,
    ref
}: DatabaseExplorerProps) {
    const { t } = useTranslation('database');
    const client = useDatabaseClient();
    const act = useDatabaseAction();
    const loads = useExplorerLoads(connections);
    const [own, setOwn] = useState<ExplorerSelection | null>(defaultValue);
    const [request, setRequest] = useState<TableRequest | null>(null);
    const { expanded, collapsed, setExpanded, setCollapsed } = useStoredExpansion(connections);
    const pressedInPopup = usePopupPress();
    const [filter, setFilter] = useState('');
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const rowElements = useRef(new Map<string, HTMLElement>());
    const focusAfterRender = useRef(false);
    const selected = value === undefined ? own : value;
    const selectedKey = selected === null ? null : selectionKey(selected);

    const input = {
        connections,
        expanded,
        collapsed,
        showSystemSchemas,
        schemas: loads.schemas,
        tables: loads.tables,
        structures: loads.structures,
        versions: loads.versions,
        folders: (connectionId: string) => folders?.[connectionId] ?? []
    };
    const rows = flattenTree({ ...input, filter });
    const stop = tabStop(rows, activeKey, selectedKey);

    useEffect(() => {
        for (const target of neededLoads(input)) {
            loads.start(target);
        }
    });

    useEffect(() => {
        if (focusAfterRender.current && activeKey !== null) {
            focusAfterRender.current = false;
            rowElements.current.get(activeKey)?.focus();
        }
    }, [activeKey]);

    const setOpen = (key: string, open: boolean): void => {
        const folder = startsOpen(key);
        const toggle = (current: ReadonlySet<string>): ReadonlySet<string> => {
            const next = new Set(current);
            if (open !== folder) {
                next.add(key);
            } else {
                next.delete(key);
            }
            return next;
        };
        (folder ? setCollapsed : setExpanded)(toggle);
    };

    const toggle = (row: ExpandableRow): void => {
        setOpen(row.key, !row.expanded);
    };

    const select = (selection: ExplorerSelection): void => {
        if (value === undefined) {
            setOwn(selection);
        }
        onValueChange?.(selection);
    };

    const pick = (row: TreeRow): void => {
        const selection = selectionOf(row);
        if (selection !== null) {
            select(selection);
        }
    };

    /* `preview` says a click opened it, which only an explorer that opens on a click tells the app. */
    const open = (row: TreeRow, preview = false): void => {
        if (row.kind === 'appItem') {
            row.item.onOpen?.({ preview });
            return;
        }
        const ref = openedTableOf(row);
        if (ref === null) {
            return;
        }
        pick(row);
        const tableKind = row.kind === 'table' && row.ref === ref ? row.table.kind : tableKindIn(loads.tables(ref.connectionId, ref.schema), ref.table);
        act?.({ kind: 'open-table', ref, view: 'data', ...(tableKind === undefined ? {} : { tableKind }), ...(openOnClick ? { preview } : {}) });
    };

    const activate = (row: TreeRow): void => {
        switch (row.kind) {
            case 'table':
            case 'column':
            case 'entry':
            case 'appItem':
                open(row);
                break;
            case 'connection':
            case 'schema':
            case 'folder':
            case 'part':
            case 'appFolder':
                pick(row);
                toggle(row);
                break;
            case 'error':
                loads.reset(row.retry);
                break;
        }
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
        if ((e.target as HTMLElement).tagName === 'BUTTON') {
            return;
        }
        const action = navigate(rows, activeKey ?? stop, e.key);
        if (action === null) {
            return;
        }
        e.preventDefault();
        if (action.type === 'focus') {
            focusAfterRender.current = true;
            setActiveKey(action.key);
        } else if (action.type === 'activate') {
            const row = rows.find((candidate) => candidate.key === action.key);
            if (row !== undefined) {
                activate(row);
            }
        } else {
            setOpen(action.key, action.type === 'expand');
        }
    };

    /* `count` is the click's `detail`: the second click of a double click leaves the opening to the double click. */
    const click = (row: TreeRow, count: number): void => {
        if (pressedInPopup()) {
            return;
        }
        setActiveKey(row.key);
        if (openOnClick && (row.kind === 'table' || row.kind === 'appItem')) {
            if (count <= 1) {
                open(row, true);
            }
            return;
        }
        pick(row);
        if (row.kind !== 'table' && isExpandable(row)) {
            toggle(row);
        } else if (row.kind === 'error') {
            loads.reset(row.retry);
        }
    };

    const refresh = (target: LoadTarget): void => {
        loads.reset(target);
    };

    const disconnect = (connection: Connection): void => {
        void client.disconnect(connection.id).catch(() => undefined);
        loads.reset({ connectionId: connection.id });
        setOpen(connectionKey(connection.id), false);
    };

    const finish = (done: TableRequest, to: string | undefined): void => {
        setRequest(null);
        const { connectionId, schema, table } = done.ref;
        if (selected?.connectionId === connectionId && selected.schema === schema && selected.table === table) {
            select(to === undefined ? { connectionId, schema } : { connectionId, schema, table: to });
        }
    };

    const connectionOf = (row: TreeRow): Connection | undefined => {
        const selection = selectionOf(row);
        return selection === null ? undefined : connections.find((entry) => entry.id === selection.connectionId);
    };

    const isSelected = (row: TreeRow | undefined): boolean => row !== undefined && isSelectable(row) && row.key === selectedKey;

    const renderRow = (row: TreeRow, index: number): ReactNode => {
        const connection = connectionOf(row);
        const menu =
            row.kind === 'appItem' ? (
                (row.item.menu ?? null)
            ) : connection !== undefined && hasMenu(row) ? (
                <RowMenu row={row} connection={connection} onRefresh={refresh} onDisconnect={disconnect} onRequest={setRequest} />
            ) : null;
        const selectedRow = isSelected(row);
        const props = {
            level: row.level,
            selected: selectedRow,
            joinedStart: selectedRow && isSelected(rows[index - 1]),
            joinedEnd: selectedRow && isSelected(rows[index + 1]),
            interactive: row.focusable,
            'aria-setsize': row.setSize,
            'aria-posinset': row.posInSet,
            'aria-expanded': isExpandable(row) ? row.expanded : undefined,
            'aria-selected': isSelectable(row) ? selectedRow : undefined,
            'aria-busy': row.kind === 'loading' ? true : undefined,
            tabIndex: row.focusable ? (row.key === stop ? 0 : -1) : undefined,
            ref: (element: HTMLElement | null) => {
                if (element === null) {
                    rowElements.current.delete(row.key);
                } else {
                    rowElements.current.set(row.key, element);
                }
            },
            onClick: (event: MouseEvent) => click(row, event.detail),
            onDoubleClick: tableOf(row) === null && row.kind !== 'appItem' ? undefined : () => open(row),
            onFocus: () => {
                if (row.focusable) {
                    setActiveKey(row.key);
                }
            }
        };
        const content = <RowContent row={row} onToggle={isExpandable(row) ? () => toggle(row) : undefined} />;
        if (menu === null) {
            return (
                <Tree.Row key={row.key} {...props}>
                    {content}
                </Tree.Row>
            );
        }
        return (
            <ContextMenu.Root key={row.key}>
                <ContextMenu.Trigger render={<Tree.Row {...props} />}>{content}</ContextMenu.Trigger>
                <ContextMenu.Popup>{menu}</ContextMenu.Popup>
            </ContextMenu.Root>
        );
    };

    return (
        <div ref={ref} className={clsx('flex min-h-0 min-w-0 flex-col', className)}>
            <div className="shrink-0 border-b border-border p-2">
                <Input
                    size="sm"
                    icon={Search}
                    type="search"
                    value={filter}
                    placeholder={t('explorer.filter')}
                    aria-label={t('explorer.filter')}
                    spellCheck={false}
                    onChange={(e) => setFilter(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            setFilter('');
                        }
                    }}
                />
            </div>
            {connections.length === 0 ? (
                <EmptyState icon={Database}>{t('explorer.noConnections')}</EmptyState>
            ) : rows.length === 0 ? (
                <EmptyState icon={Search}>{t('explorer.noMatches', { query: filter.trim() })}</EmptyState>
            ) : (
                <Tree.Root aria-label={t('explorer.label')} overflow="scroll" className="min-h-0 grow overflow-y-auto pt-2" onKeyDown={onKeyDown}>
                    {rows.map(renderRow)}
                </Tree.Root>
            )}
            {request !== null && <TableDialog request={request} onClose={() => setRequest(null)} onDone={finish} />}
        </div>
    );
}

function RowContent({ row, onToggle }: { row: TreeRow; onToggle?: () => void }) {
    const { t } = useTranslation('database');
    switch (row.kind) {
        case 'connection':
            return (
                <>
                    <Tree.Chevron expanded={row.expanded} onExpandedChange={onToggle} />
                    <EngineIcon engine={row.connection.config.engine} size={16} className="shrink-0 text-text-muted" />
                    <Tree.Label>{row.connection.name || t('connections.untitled')}</Tree.Label>
                    {row.connection.config.readOnly === true && (
                        <Tooltip label={t('explorer.readOnly')}>
                            <span className="inline-flex shrink-0 text-text-faint">
                                <Icon icon={Lock} size={12} />
                            </span>
                        </Tooltip>
                    )}
                    {row.version !== null && <span className="text-text-faint">{row.version}</span>}
                    {row.schemaCount !== null && <SchemaCount shown={row.schemaCount.shown} total={row.schemaCount.total} />}
                </>
            );
        case 'schema':
            return (
                <>
                    <Tree.Chevron expanded={row.expanded} onExpandedChange={onToggle} />
                    <Icon icon={Database} size={16} className="shrink-0 text-text-muted" />
                    <Tree.Label>{row.schema}</Tree.Label>
                </>
            );
        case 'folder':
            return (
                <>
                    <Tree.Chevron expanded={row.expanded} onExpandedChange={onToggle} />
                    <Icon icon={Folder} size={16} className="shrink-0 text-text-muted" />
                    <Tree.Label>{t(row.group === 'view' ? 'explorer.views' : 'explorer.tables')}</Tree.Label>
                    <span className="shrink-0 text-text-faint tabular-nums">{formatNumber(row.count)}</span>
                </>
            );
        case 'table':
            return (
                <>
                    <Tree.Chevron expanded={row.expanded} onExpandedChange={onToggle} />
                    <Icon icon={row.table.kind === 'view' ? Eye : Table} size={16} className="shrink-0 text-text-muted" />
                    <Tree.Label>{row.table.name}</Tree.Label>
                </>
            );
        case 'part':
            return (
                <>
                    <Tree.Chevron expanded={row.expanded} onExpandedChange={onToggle} />
                    <Icon icon={Folder} size={16} className="shrink-0 text-text-muted" />
                    <Tree.Label>{t(`explorer.parts.${row.part}`)}</Tree.Label>
                    <span className="shrink-0 text-text-faint tabular-nums">{formatNumber(row.count)}</span>
                </>
            );
        case 'appFolder':
            return (
                <>
                    <Tree.Chevron expanded={row.expanded} onExpandedChange={onToggle} />
                    <Icon icon={Folder} size={16} className="shrink-0 text-text-muted" />
                    <Tree.Label>{row.folder.label}</Tree.Label>
                    <span className="shrink-0 text-text-faint tabular-nums">{formatNumber(row.count)}</span>
                </>
            );
        case 'appItem':
            return (
                <>
                    <Tree.ChevronSlot />
                    <Icon icon={row.item.icon} size={16} className="shrink-0 text-text-muted" />
                    <Tree.Label>{row.item.label}</Tree.Label>
                </>
            );
        case 'entry':
            return <EntryContent row={row} />;
        case 'column':
            return (
                <>
                    <Tree.ChevronSlot />
                    <ColumnIcon primaryKey={row.primaryKey} foreignKey={row.foreignKey} />
                    <Tree.Label>{row.column.name}</Tree.Label>
                    {row.column.type !== '' && <span className="text-text-faint">{row.column.type}</span>}
                </>
            );
        case 'loading':
            return (
                <>
                    <Tree.ChevronSlot />
                    <Spinner size={12} />
                    <span className="text-text-faint">{t('explorer.loading')}</span>
                </>
            );
        case 'error':
            return <ErrorContent row={row} />;
        case 'empty':
            return (
                <>
                    <Tree.ChevronSlot />
                    <span className="text-text-faint">{t(EMPTY_WORDS[row.of])}</span>
                </>
            );
    }
}

const EMPTY_WORDS = { schemas: 'explorer.noSchemas', tables: 'explorer.noTables', columns: 'explorer.noColumns' } as const;

function SchemaCount({ shown, total }: { shown: number; total: number }) {
    const { t } = useTranslation('database');
    const counts = { shown: formatNumber(shown), total: formatNumber(total) };
    return (
        <Tooltip label={t('explorer.schemaCountHint', { count: total, ...counts })}>
            <span className="shrink-0 text-text-faint tabular-nums">{t('explorer.schemaCount', counts)}</span>
        </Tooltip>
    );
}

/* A step smaller than the icons of the rows above, in the same 16px slot, so the names stay in line. */
const ENTRY_ICON_SLOT = 'inline-flex size-4 shrink-0 items-center justify-center';

function ColumnIcon(keys: ColumnKeys) {
    const { t } = useTranslation('database');
    if (!keys.primaryKey && !keys.foreignKey) {
        return (
            <span className={ENTRY_ICON_SLOT}>
                <Icon icon={Columns2} size={14} className="text-text-faint" />
            </span>
        );
    }
    return (
        <Tooltip label={t(keyLabelOf(keys))}>
            <span className={ENTRY_ICON_SLOT}>
                <KeyIcon {...keys} size={14} />
            </span>
        </Tooltip>
    );
}

/* A key, a foreign key, an index, a check or a trigger of a table: its name, and what it covers in the quiet color of a column's type. */
function EntryContent({ row }: { row: EntryRow }) {
    const { t } = useTranslation('database');
    const { entry } = row;
    const icon = (glyph: LucideIcon, className: string): ReactNode => (
        <span className={ENTRY_ICON_SLOT}>
            <Icon icon={glyph} size={14} className={className} />
        </span>
    );
    switch (entry.type) {
        case 'key':
            return (
                <>
                    <Tree.ChevronSlot />
                    {icon(KeyRound, entry.primary ? 'text-(--file-icon-yellow)' : 'text-text-muted')}
                    <Tree.Label>{entry.name ?? t('explorer.primaryKey')}</Tree.Label>
                    <span className="text-text-faint">{entry.columns.join(', ')}</span>
                </>
            );
        case 'foreignKey': {
            const { foreignKey } = entry;
            const columns = foreignKey.columns.join(', ');
            return (
                <>
                    <Tree.ChevronSlot />
                    {icon(KeyRound, 'text-(--file-icon-blue)')}
                    <Tree.Label>{foreignKey.name ?? columns}</Tree.Label>
                    <span className="text-text-faint">
                        {t('explorer.references', {
                            columns,
                            table: foreignKey.referencedTable,
                            referenced: foreignKey.referencedColumns.join(', ')
                        })}
                    </span>
                </>
            );
        }
        case 'index':
            return (
                <>
                    <Tree.ChevronSlot />
                    {icon(ListOrdered, 'text-text-faint')}
                    <Tree.Label>{entry.index.name}</Tree.Label>
                    <span className="text-text-faint">{entry.index.columns.join(', ')}</span>
                    {entry.index.unique && <span className="text-text-faint">{t('explorer.unique')}</span>}
                </>
            );
        case 'check':
            return (
                <>
                    <Tree.ChevronSlot />
                    {icon(ShieldCheck, 'text-text-faint')}
                    <Tree.Label>{entry.check.name ?? t('explorer.check')}</Tree.Label>
                    <span className="font-mono text-text-faint">{entry.check.expression}</span>
                </>
            );
        case 'trigger':
            return (
                <>
                    <Tree.ChevronSlot />
                    {icon(Zap, 'text-text-faint')}
                    <Tree.Label>{entry.trigger.name}</Tree.Label>
                    <span className="text-text-faint">{`${entry.trigger.timing} ${entry.trigger.event}`}</span>
                </>
            );
    }
}

function ErrorContent({ row }: { row: ErrorRow }) {
    const { t } = useTranslation('database');
    return (
        <>
            <Tree.ChevronSlot />
            <Icon icon={CircleAlert} size={16} className="shrink-0 text-status-error" />
            <Tooltip label={row.message}>
                <span className="min-w-0 truncate text-status-error">{row.message}</span>
            </Tooltip>
            <Button size="xs" variant="ghost" className="ml-auto" tabIndex={-1}>
                {t('explorer.retry')}
            </Button>
        </>
    );
}
