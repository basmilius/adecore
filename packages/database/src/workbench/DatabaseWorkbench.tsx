import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import clsx from 'clsx';
import { PencilRuler, Settings2, SquareTerminal, Table, TableProperties } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    Button,
    ColumnResizeHandle,
    Dialog,
    EmptyState,
    Icon,
    IconButton,
    PromptDialog,
    Segmented,
    Tabs,
    isApplePlatform,
    matchesShortcut,
    shortcut,
    useColumnResize
} from '@adecore/ui';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { DatabaseAction, ExplorerSelection } from '../actions.ts';
import { useDatabaseAction, useDatabaseClient, useDatabaseFiles, useDatabaseStorage } from '../client-context.ts';
import type { Connection } from '../client/types.ts';
import { ConnectionManager } from '../connections/ConnectionManager.tsx';
import { QueryConsole } from '../console/QueryConsole.tsx';
import { DatabaseExplorer } from '../explorer/DatabaseExplorer.tsx';
import { DesignerTab } from './DesignerTab.tsx';
import { TableTab } from './TableTab.tsx';
import {
    closeTab,
    connectionIdOf,
    focusTab,
    openConsole,
    openDesigner,
    openTable,
    parseState,
    pruneTabs,
    serializeState,
    setConsoleSql,
    setDesignerTable,
    setTableView,
    STORAGE_KEY,
    type WorkbenchTab
} from './tabs.ts';
import { useStableCallback } from '../use-stable-callback.ts';

export interface DatabaseWorkbenchProps {
    connections: readonly Connection[];
    /* Saving is the app's. Without it the connections are fixed: there is no way to manage them from here. */
    onConnectionsChange?(next: readonly Connection[]): void;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;

/*
 * The whole database view in one piece: the explorer beside closable tabs for the tables, consoles and
 * designers a person opens. It answers the actions of the views below itself; an action it cannot place
 * goes on to the `DatabaseProvider` above it. The open tabs are kept through the provider's `storage`.
 */
export function DatabaseWorkbench({ connections, onConnectionsChange, className, ref }: DatabaseWorkbenchProps) {
    const { t } = useTranslation('database');
    const client = useDatabaseClient();
    const outer = useDatabaseAction();
    const storage = useDatabaseStorage();
    const files = useDatabaseFiles();
    const column = useRef<HTMLElement>(null);
    const [state, setState] = useState(() => parseState(storage?.get(STORAGE_KEY) ?? null));
    const [selection, setSelection] = useState<ExplorerSelection | null>(null);
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const [managing, setManaging] = useState(false);
    const [managed, setManaged] = useState<string | null>(null);
    /* Ids of the table tabs that hold changes nobody submitted, and the tab a person asked to close while it does. */
    const [dirty, setDirty] = useState<ReadonlySet<string>>(() => new Set());
    const [closing, setClosing] = useState<string | null>(null);
    const { startResize } = useColumnResize(column, { size: width, min: MIN_WIDTH, from: 'left', max: () => window.innerWidth / 2, onSize: setWidth });

    const known = useMemo(() => new Set(connections.map((connection) => connection.id)), [connections]);
    // While there are no connections they may still be loading, so nothing is dropped then.
    const pruned = known.size > 0 ? pruneTabs(state, known) : state;
    if (pruned !== state) {
        setState(pruned);
    }
    if ([...dirty].some((id) => !state.tabs.some((tab) => tab.id === id))) {
        setDirty(new Set([...dirty].filter((id) => state.tabs.some((tab) => tab.id === id))));
    }
    const tabs = state.tabs.filter((tab) => known.has(connectionIdOf(tab)));
    const active = tabs.find((tab) => tab.id === state.activeId) ?? tabs.at(-1) ?? null;
    const canManage = onConnectionsChange !== undefined;

    useEffect(() => {
        storage?.set(STORAGE_KEY, serializeState(state));
    }, [storage, state]);

    const onAction = useStableCallback((action: DatabaseAction): void => {
        const connectionId = action.kind === 'open-table' || action.kind === 'edit-table' ? action.ref.connectionId : action.connectionId;
        if (!known.has(connectionId) || (action.kind === 'manage-connection' && !canManage)) {
            outer?.(action);
            return;
        }
        switch (action.kind) {
            case 'open-table':
                setSelection(action.ref);
                setState((current) => openTable(current, action.ref, action.view, action.where));
                break;
            case 'open-console':
                setState((current) => openConsole(current, action.connectionId, action.schema, action.sql));
                break;
            case 'new-table':
                setState((current) => openDesigner(current, action.connectionId, action.schema));
                break;
            case 'edit-table':
                setState((current) => openDesigner(current, action.ref.connectionId, action.ref.schema, action.ref.table));
                break;
            case 'manage-connection':
                setManaged(action.connectionId);
                setManaging(true);
                break;
        }
    });

    function newConsole(): void {
        const context = consoleContext();
        if (context !== null) {
            setState((current) => openConsole(current, context.connectionId, context.schema));
        }
    }

    /* Where a new console runs: the connection of the tab in front, else the one picked in the explorer, else the first. */
    function consoleContext(): { readonly connectionId: string; readonly schema?: string } | null {
        if (active !== null) {
            return { connectionId: connectionIdOf(active), schema: active.kind === 'table' ? active.ref.schema : active.schema };
        }
        if (selection !== null && known.has(selection.connectionId)) {
            return { connectionId: selection.connectionId, schema: selection.schema };
        }
        const first = connections[0];
        return first === undefined ? null : { connectionId: first.id };
    }

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
        // A dialog opened from here is a portal: its events reach this handler through React, not through the DOM.
        if (
            active !== null &&
            e.currentTarget.contains(e.target as Node) &&
            !e.nativeEvent.isComposing &&
            matchesShortcut(shortcut('Mod+W'), e.nativeEvent, isApplePlatform())
        ) {
            e.preventDefault();
            requestClose(active.id);
        }
    }

    function closeById(id: string): void {
        setState((current) => closeTab(current, id));
    }

    /* A table tab with changes that are not submitted asks first. */
    function requestClose(id: string): void {
        if (dirty.has(id)) {
            setClosing(id);
        } else {
            closeById(id);
        }
    }

    function markDirty(id: string, isDirty: boolean): void {
        setDirty((current) => {
            if (current.has(id) === isDirty) {
                return current;
            }
            const next = new Set(current);
            if (isDirty) {
                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    }

    const titleOf = (tab: WorkbenchTab): string => {
        switch (tab.kind) {
            case 'table':
                return tab.where === undefined ? tab.ref.table : t('workbench.filtered', { table: tab.ref.table });
            case 'console':
                return t('workbench.console', { number: tab.number });
            case 'designer':
                return tab.table === undefined ? t('workbench.newTable') : t('workbench.designer', { table: tab.table });
        }
    };

    const viewOf = (tab: WorkbenchTab) => {
        const connection = connections.find((entry) => entry.id === connectionIdOf(tab));
        if (connection === undefined) {
            return null;
        }
        switch (tab.kind) {
            case 'table':
                return <TableTab connection={connection} tab={tab} onDirtyChange={(isDirty) => markDirty(tab.id, isDirty)} />;
            case 'console':
                return (
                    <QueryConsole
                        connection={connection}
                        schema={tab.schema}
                        value={tab.sql}
                        onValueChange={(sql) => setState((current) => setConsoleSql(current, tab.id, sql))}
                        autoFocus={tab.id === active?.id}
                        className="h-full"
                    />
                );
            case 'designer':
                return (
                    <DesignerTab connection={connection} tab={tab} onTableChange={(table) => setState((current) => setDesignerTable(current, tab.id, table))} />
                );
        }
    };

    const canOpenConsole = consoleContext() !== null;
    const closingTab = state.tabs.find((tab) => tab.id === closing);
    const closingTable = closingTab?.kind === 'table' ? closingTab.ref.table : '';

    return (
        <DatabaseProvider client={client} onAction={onAction} storage={storage} files={files}>
            <div ref={ref} className={clsx('flex h-full min-h-0 min-w-0 bg-surface text-text', className)} onKeyDown={onKeyDown}>
                <aside ref={column} className="relative flex shrink-0 flex-col border-r border-border" style={{ width }}>
                    <header className="flex h-9 shrink-0 items-center justify-between border-b border-border pr-2 pl-3">
                        <h2 className="text-sm font-semibold text-text">{t('workbench.title')}</h2>
                        {canManage && (
                            <IconButton
                                icon={Settings2}
                                size="sm"
                                label={t('workbench.manage')}
                                onClick={() => {
                                    setManaged(null);
                                    setManaging(true);
                                }}
                            />
                        )}
                    </header>
                    <DatabaseExplorer connections={connections} value={selection} onValueChange={setSelection} className="min-h-0 flex-1" />
                    <ColumnResizeHandle from="left" onPointerDown={startResize} />
                </aside>
                <Tabs.Root
                    value={active?.id ?? null}
                    onValueChange={(id) => setState((current) => focusTab(current, String(id)))}
                    className="flex min-h-0 min-w-0 flex-1 flex-col"
                >
                    <Tabs.List
                        aria-label={t('workbench.tabs')}
                        className="px-2"
                        end={
                            <>
                                {active?.kind === 'table' && (
                                    <Segmented
                                        label={t('workbench.views')}
                                        value={active.view}
                                        onValueChange={(view) => setState((current) => setTableView(current, active.id, view))}
                                        options={[
                                            { id: 'data', label: t('workbench.data'), icon: Table },
                                            { id: 'structure', label: t('workbench.structure'), icon: TableProperties }
                                        ]}
                                    />
                                )}
                                <IconButton
                                    icon={SquareTerminal}
                                    size="sm"
                                    label={t('workbench.newConsole')}
                                    tooltip={canOpenConsole ? undefined : t('workbench.noConnection')}
                                    disabled={!canOpenConsole}
                                    onClick={newConsole}
                                />
                            </>
                        }
                    >
                        {tabs.map((tab) => (
                            <Tabs.Tab key={tab.id} value={tab.id} onClose={() => requestClose(tab.id)}>
                                <Icon icon={tab.kind === 'table' ? Table : tab.kind === 'console' ? SquareTerminal : PencilRuler} size={14} />
                                {titleOf(tab)}
                            </Tabs.Tab>
                        ))}
                    </Tabs.List>
                    {tabs.length === 0 ? (
                        <EmptyState
                            icon={SquareTerminal}
                            title={t('workbench.empty.title')}
                            className="flex-1"
                            action={
                                <Button variant="secondary" disabled={!canOpenConsole} onClick={newConsole}>
                                    {t('workbench.newConsole')}
                                </Button>
                            }
                        >
                            {t('workbench.empty.body')}
                        </EmptyState>
                    ) : (
                        tabs.map((tab) => (
                            <Tabs.Panel key={tab.id} value={tab.id} keepMounted className="min-h-0 flex-1">
                                {viewOf(tab)}
                            </Tabs.Panel>
                        ))
                    )}
                </Tabs.Root>
                <PromptDialog
                    open={closing !== null}
                    danger
                    title={t('workbench.discard.title', { table: closingTable })}
                    description={t('workbench.discard.description')}
                    confirmLabel={t('workbench.discard.confirm')}
                    onConfirm={() => {
                        if (closing !== null) {
                            closeById(closing);
                        }
                        setClosing(null);
                    }}
                    onOpenChange={(open) => {
                        if (!open) {
                            setClosing(null);
                        }
                    }}
                />
                {onConnectionsChange !== undefined && (
                    <Dialog.Root open={managing} onOpenChange={setManaging}>
                        <Dialog.Popup className="flex h-[560px] w-[900px] flex-col overflow-hidden">
                            <div className="border-b border-border px-4 py-3">
                                <Dialog.Title>{t('workbench.connections')}</Dialog.Title>
                            </div>
                            <ConnectionManager
                                value={connections}
                                onValueChange={onConnectionsChange}
                                selected={managed}
                                onSelectedChange={setManaged}
                                className="min-h-0 flex-1"
                            />
                            <Dialog.Footer>
                                <Dialog.Close render={<Button variant="secondary" />}>{t('workbench.close')}</Dialog.Close>
                            </Dialog.Footer>
                        </Dialog.Popup>
                    </Dialog.Root>
                )}
            </div>
        </DatabaseProvider>
    );
}
