import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { ChevronRight, CircleAlert, Database, Eye, Folder, KeyRound, Link2, Lock, RectangleVertical, Search, Table } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, ContextMenu, EmptyState, Icon, Input, Spinner, Tooltip, copyText } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import { useDatabaseClient } from '../client-context.ts';
import type { Connection, TableRef } from '../client/types.ts';
import { EngineIcon } from '../connections/EngineIcon.tsx';
import {
    connectionKey,
    flattenTree,
    isExpandable,
    isFolderKey,
    navigate,
    neededLoads,
    tabStop,
    tableKey,
    tableOf,
    type ErrorRow,
    type ExpandableRow,
    type TreeRow
} from './tree.ts';
import { useExplorerLoads } from './use-explorer-loads.ts';

const INDENT = 16;
/* Where the chevron slot of the first level starts inside a row. */
const BASE_INDENT = 4;
const CHEVRON_SIZE = 16;

export interface DatabaseExplorerProps {
    connections: readonly Connection[];
    /* The selected table. Without it the explorer keeps the selection itself, starting at `defaultValue`. */
    value?: TableRef | null;
    defaultValue?: TableRef | null;
    onValueChange?(ref: TableRef | null): void;
    /* A double click or Enter on a table, or Open in its menu. */
    onOpen?(ref: TableRef): void;
    showSystemSchemas?: boolean;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* The connections, their schemas and their tables as a tree, loaded as each node opens. */
export function DatabaseExplorer({
    connections,
    value,
    defaultValue = null,
    onValueChange,
    onOpen,
    showSystemSchemas = false,
    className,
    ref
}: DatabaseExplorerProps) {
    const { t } = useTranslation('database');
    const client = useDatabaseClient();
    const loads = useExplorerLoads(connections);
    const [own, setOwn] = useState<TableRef | null>(defaultValue);
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
    const [filter, setFilter] = useState('');
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const rowElements = useRef(new Map<string, HTMLElement>());
    const focusAfterRender = useRef(false);
    const selected = value === undefined ? own : value;
    const selectedKey = selected === null ? null : tableKey(selected);

    const input = {
        connections,
        expanded,
        collapsed,
        showSystemSchemas,
        schemas: loads.schemas,
        tables: loads.tables,
        structures: loads.structures,
        versions: loads.versions
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
        // A folder is open until the person closes it, everything else is closed until they open it.
        const folder = isFolderKey(key);
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

    const select = (ref: TableRef): void => {
        if (value === undefined) {
            setOwn(ref);
        }
        onValueChange?.(ref);
    };

    const activate = (row: TreeRow): void => {
        switch (row.kind) {
            case 'table':
                select(row.ref);
                onOpen?.(row.ref);
                break;
            case 'column':
                select(row.ref);
                onOpen?.(row.ref);
                break;
            case 'connection':
            case 'schema':
            case 'folder':
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

    const click = (row: TreeRow): void => {
        setActiveKey(row.key);
        if (row.kind === 'table') {
            select(row.ref);
        } else if (isExpandable(row)) {
            toggle(row);
        } else if (row.kind === 'error') {
            loads.reset(row.retry);
        }
    };

    const refresh = (connection: Connection): void => {
        loads.reset({ connectionId: connection.id });
    };

    const disconnect = (connection: Connection): void => {
        void client.disconnect(connection.id).catch(() => undefined);
        loads.reset({ connectionId: connection.id });
        setOpen(connectionKey(connection.id), false);
    };

    const menuOf = (row: TreeRow): ReactNode => {
        switch (row.kind) {
            case 'connection':
                return (
                    <>
                        <ContextMenu.Item onClick={() => refresh(row.connection)}>{t('explorer.refresh')}</ContextMenu.Item>
                        <ContextMenu.Item onClick={() => disconnect(row.connection)}>{t('explorer.disconnect')}</ContextMenu.Item>
                    </>
                );
            case 'schema':
                return (
                    <ContextMenu.Item onClick={() => loads.reset({ connectionId: row.connection.id, schema: row.schema })}>
                        {t('explorer.refresh')}
                    </ContextMenu.Item>
                );
            case 'table':
                return (
                    <>
                        <ContextMenu.Item onClick={() => onOpen?.(row.ref)}>{t('explorer.open')}</ContextMenu.Item>
                        <ContextMenu.Item onClick={() => copyText(row.ref.table)}>{t('explorer.copyName')}</ContextMenu.Item>
                    </>
                );
            case 'column':
                return (
                    <>
                        <ContextMenu.Item onClick={() => onOpen?.(row.ref)}>{t('explorer.open')}</ContextMenu.Item>
                        <ContextMenu.Item onClick={() => copyText(row.column.name)}>{t('explorer.copyName')}</ContextMenu.Item>
                    </>
                );
            default:
                return null;
        }
    };

    const isSelected = (row: TreeRow | undefined): boolean => row !== undefined && row.kind === 'table' && row.key === selectedKey;

    const renderRow = (row: TreeRow, index: number): ReactNode => {
        const menu = menuOf(row);
        const selectedRow = isSelected(row);
        const props = {
            role: 'treeitem',
            'aria-level': row.level,
            'aria-setsize': row.setSize,
            'aria-posinset': row.posInSet,
            'aria-expanded': isExpandable(row) ? row.expanded : undefined,
            'aria-selected': row.kind === 'table' ? selectedRow : undefined,
            'aria-busy': row.kind === 'loading' ? true : undefined,
            tabIndex: row.focusable ? (row.key === stop ? 0 : -1) : undefined,
            className: clsx(
                // The line box is the row's height, so the text lands on whole pixels in a row of an odd height.
                'focus-ring relative mx-2 flex h-[25px] min-w-0 items-center gap-1.5 rounded-md pr-2 text-xs leading-[25px] text-text focus-visible:-outline-offset-2',
                selectedRow ? 'bg-surface-active' : row.focusable && 'hover:bg-surface-hover',
                selectedRow && isSelected(rows[index - 1]) && 'rounded-t-none',
                selectedRow && isSelected(rows[index + 1]) && 'rounded-b-none'
            ),
            style: { paddingInlineStart: BASE_INDENT + (row.level - 1) * INDENT },
            ref: (element: HTMLElement | null) => {
                if (element === null) {
                    rowElements.current.delete(row.key);
                } else {
                    rowElements.current.set(row.key, element);
                }
            },
            onClick: () => click(row),
            onDoubleClick: tableOf(row) === null ? undefined : () => activate(row),
            onFocus: () => {
                if (row.focusable) {
                    setActiveKey(row.key);
                }
            }
        };
        const content = (
            <>
                {Array.from({ length: row.level - 1 }, (_, i) => (
                    <span
                        key={i}
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 w-px bg-border"
                        style={{ insetInlineStart: BASE_INDENT + i * INDENT + CHEVRON_SIZE / 2 - 1 }}
                    />
                ))}
                <RowContent row={row} onToggle={isExpandable(row) ? () => toggle(row) : undefined} />
            </>
        );
        if (menu === null) {
            return (
                <div key={row.key} {...props}>
                    {content}
                </div>
            );
        }
        return (
            <ContextMenu.Root key={row.key}>
                <ContextMenu.Trigger render={<div {...props} />}>{content}</ContextMenu.Trigger>
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
                <div role="tree" aria-label={t('explorer.label')} className="min-h-0 grow overflow-y-auto py-2" onKeyDown={onKeyDown}>
                    {rows.map(renderRow)}
                </div>
            )}
        </div>
    );
}

function RowContent({ row, onToggle }: { row: TreeRow; onToggle?: () => void }) {
    const { t } = useTranslation('database');
    switch (row.kind) {
        case 'connection':
            return (
                <>
                    <Chevron open={row.expanded} onToggle={onToggle} />
                    <EngineIcon engine={row.connection.config.engine} size={16} className="shrink-0 text-text-muted" />
                    <span className="min-w-0 truncate">{row.connection.name || t('connections.untitled')}</span>
                    {row.connection.config.readOnly === true && (
                        <Tooltip label={t('explorer.readOnly')}>
                            <span className="inline-flex shrink-0 text-text-faint">
                                <Icon icon={Lock} size={12} />
                            </span>
                        </Tooltip>
                    )}
                    {row.version !== null && <span className="min-w-0 shrink-[2] truncate text-text-faint">{row.version}</span>}
                    {row.schemaCount !== null && <SchemaCount shown={row.schemaCount.shown} total={row.schemaCount.total} />}
                </>
            );
        case 'schema':
            return (
                <>
                    <Chevron open={row.expanded} onToggle={onToggle} />
                    <Icon icon={Database} size={16} className="shrink-0 text-text-muted" />
                    <span className="min-w-0 truncate">{row.schema}</span>
                </>
            );
        case 'folder':
            return (
                <>
                    <Chevron open={row.expanded} onToggle={onToggle} />
                    <Icon icon={Folder} size={16} className="shrink-0 text-text-muted" />
                    <span className="min-w-0 truncate">{t(row.group === 'view' ? 'explorer.views' : 'explorer.tables')}</span>
                    <span className="shrink-0 text-text-faint tabular-nums">{formatNumber(row.count)}</span>
                </>
            );
        case 'table':
            return (
                <>
                    <Chevron open={row.expanded} onToggle={onToggle} />
                    <Icon icon={row.table.kind === 'view' ? Eye : Table} size={16} className="shrink-0 text-text-muted" />
                    <span className="min-w-0 truncate">{row.table.name}</span>
                </>
            );
        case 'column':
            return (
                <>
                    <ChevronSlot />
                    <ColumnIcon primaryKey={row.primaryKey} foreignKey={row.foreignKey} />
                    <span className="min-w-0 truncate">{row.column.name}</span>
                    {row.column.type !== '' && <span className="min-w-0 shrink-[2] truncate text-text-faint">{row.column.type}</span>}
                </>
            );
        case 'loading':
            return (
                <>
                    <ChevronSlot />
                    <Spinner size={12} />
                    <span className="text-text-faint">{t('explorer.loading')}</span>
                </>
            );
        case 'error':
            return <ErrorContent row={row} />;
        case 'empty':
            return (
                <>
                    <ChevronSlot />
                    <span className="text-text-faint">{t(EMPTY_WORDS[row.of])}</span>
                </>
            );
    }
}

const EMPTY_WORDS = { schemas: 'explorer.noSchemas', tables: 'explorer.noTables', columns: 'explorer.noColumns' } as const;

/* Where a chevron would be, so a row without one lines up with its siblings that have one. */
function ChevronSlot() {
    return <span className="size-4 shrink-0" />;
}

function Chevron({ open, onToggle }: { open: boolean; onToggle?: () => void }) {
    return (
        <span
            className="grid size-4 shrink-0 place-items-center text-text-muted"
            onClick={(e) => {
                e.stopPropagation();
                onToggle?.();
            }}
            onDoubleClick={(e) => e.stopPropagation()}
        >
            <Icon icon={ChevronRight} size={12} className={clsx('transition-transform', open && 'rotate-90')} />
        </span>
    );
}

function SchemaCount({ shown, total }: { shown: number; total: number }) {
    const { t } = useTranslation('database');
    const counts = { shown: formatNumber(shown), total: formatNumber(total) };
    return (
        <Tooltip label={t('explorer.schemaCountHint', { count: total, ...counts })}>
            <span className="shrink-0 text-text-faint tabular-nums">{t('explorer.schemaCount', counts)}</span>
        </Tooltip>
    );
}

function ColumnIcon({ primaryKey, foreignKey }: { primaryKey: boolean; foreignKey: boolean }) {
    const { t } = useTranslation('database');
    if (!primaryKey && !foreignKey) {
        return <Icon icon={RectangleVertical} size={16} className="shrink-0 text-text-faint" />;
    }
    return (
        <Tooltip label={t(primaryKey ? 'explorer.primaryKey' : 'explorer.foreignKey')}>
            <span className="inline-flex shrink-0 text-text-muted">
                <Icon icon={primaryKey ? KeyRound : Link2} size={16} />
            </span>
        </Tooltip>
    );
}

function ErrorContent({ row }: { row: ErrorRow }) {
    const { t } = useTranslation('database');
    return (
        <>
            <ChevronSlot />
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
