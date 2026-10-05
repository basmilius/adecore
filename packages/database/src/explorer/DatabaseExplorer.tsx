import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { ChevronRight, CircleAlert, Database, Eye, Search, Table } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, ContextMenu, EmptyState, Icon, Input, Spinner, Tooltip, copyText } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import { useDatabaseClient } from '../client-context.ts';
import type { Connection, TableRef } from '../client/types.ts';
import { EngineIcon } from '../connections/EngineIcon.tsx';
import { connectionKey, flattenTree, isExpandable, navigate, neededLoads, tabStop, tableKey, type ErrorRow, type TreeRow } from './tree.ts';
import { useExplorerLoads } from './use-explorer-loads.ts';

const INDENT = 16;
const BASE_INDENT = 8;

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
    const [filter, setFilter] = useState('');
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const rowElements = useRef(new Map<string, HTMLElement>());
    const focusAfterRender = useRef(false);
    const selected = value === undefined ? own : value;
    const selectedKey = selected === null ? null : tableKey(selected);

    const input = { connections, expanded, showSystemSchemas, schemas: loads.schemas, tables: loads.tables };
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
        setExpanded((current) => {
            const next = new Set(current);
            if (open) {
                next.add(key);
            } else {
                next.delete(key);
            }
            return next;
        });
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
            case 'connection':
            case 'schema':
                setOpen(row.key, !row.expanded);
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
            setOpen(row.key, !row.expanded);
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
            default:
                return null;
        }
    };

    const renderRow = (row: TreeRow): ReactNode => {
        const menu = menuOf(row);
        const props = {
            role: 'treeitem',
            'aria-level': row.level,
            'aria-setsize': row.setSize,
            'aria-posinset': row.posInSet,
            'aria-expanded': isExpandable(row) ? row.expanded : undefined,
            'aria-selected': row.kind === 'table' ? row.key === selectedKey : undefined,
            'aria-busy': row.kind === 'loading' ? true : undefined,
            tabIndex: row.focusable ? (row.key === stop ? 0 : -1) : undefined,
            className: clsx(
                'focus-ring flex h-7 min-w-0 items-center gap-1.5 pr-2 text-xs text-text',
                row.kind === 'table' && row.key === selectedKey ? 'bg-surface-active' : row.focusable && 'hover:bg-surface-hover'
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
            onDoubleClick: row.kind === 'table' ? () => onOpen?.(row.ref) : undefined,
            onFocus: () => {
                if (row.focusable) {
                    setActiveKey(row.key);
                }
            }
        };
        const content = <RowContent row={row} />;
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
                <div role="tree" aria-label={t('explorer.label')} className="min-h-0 grow overflow-y-auto py-1" onKeyDown={onKeyDown}>
                    {rows.map(renderRow)}
                </div>
            )}
        </div>
    );
}

const CHEVRON_SLOT = 'grid size-4 shrink-0 place-items-center text-text-faint';

function RowContent({ row }: { row: TreeRow }) {
    const { t } = useTranslation('database');
    switch (row.kind) {
        case 'connection':
            return (
                <>
                    <Chevron open={row.expanded} />
                    <EngineIcon engine={row.connection.config.engine} size={14} className="shrink-0 text-text-muted" />
                    <span className="min-w-0 truncate">{row.connection.name || t('connections.untitled')}</span>
                </>
            );
        case 'schema':
            return (
                <>
                    <Chevron open={row.expanded} />
                    <Icon icon={Database} size={14} className="shrink-0 text-text-muted" />
                    <span className="min-w-0 truncate">{row.schema}</span>
                    {row.count !== null && <span className="shrink-0 text-text-faint tabular-nums">{formatNumber(row.count)}</span>}
                </>
            );
        case 'table':
            return (
                <>
                    <span className="size-4 shrink-0" />
                    <Icon icon={row.table.kind === 'view' ? Eye : Table} size={14} className="shrink-0 text-text-muted" />
                    <span className="min-w-0 truncate">{row.table.name}</span>
                    {row.table.kind === 'view' && <span className="shrink-0 text-2xs text-text-faint">{t('explorer.view')}</span>}
                </>
            );
        case 'loading':
            return (
                <>
                    <span className="size-4 shrink-0" />
                    <Spinner size={12} />
                    <span className="text-text-faint">{t('explorer.loading')}</span>
                </>
            );
        case 'error':
            return <ErrorContent row={row} />;
        case 'empty':
            return (
                <>
                    <span className="size-4 shrink-0" />
                    <span className="text-text-faint">{t(row.of === 'schemas' ? 'explorer.noSchemas' : 'explorer.noTables')}</span>
                </>
            );
    }
}

function Chevron({ open }: { open: boolean }) {
    return (
        <span className={CHEVRON_SLOT}>
            <Icon icon={ChevronRight} size={12} className={clsx('transition-transform', open && 'rotate-90')} />
        </span>
    );
}

function ErrorContent({ row }: { row: ErrorRow }) {
    const { t } = useTranslation('database');
    return (
        <>
            <span className="size-4 shrink-0" />
            <Icon icon={CircleAlert} size={14} className="shrink-0 text-status-error" />
            <Tooltip label={row.message}>
                <span className="min-w-0 truncate text-status-error">{row.message}</span>
            </Tooltip>
            <Button size="xs" variant="ghost" className="ml-auto" tabIndex={-1}>
                {t('explorer.retry')}
            </Button>
        </>
    );
}
