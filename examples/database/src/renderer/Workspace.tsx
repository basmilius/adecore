import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cable, PencilRuler, SquareTerminal, Table, TableProperties, type LucideIcon } from 'lucide-react';
import { ConnectionManager, QueryConsole, TableDesigner, type Connection } from '@adecore/database';
import { Button, EmptyState, Icon, IconButton, PromptDialog, Segmented, Tabs } from '@adecore/ui';
import type { BrowsePurpose } from '../shared/bridge.ts';
import { TableTab } from './TableTab.tsx';
import { connectionIdOf, type TableViewMode, type WorkTab } from './useTabs.ts';

export interface WorkspaceProps {
    connections: readonly Connection[];
    onConnectionsChange(next: readonly Connection[]): void;
    onBrowse(purpose: BrowsePurpose): Promise<string | null>;
    tabs: readonly WorkTab[];
    activeId: string | null;
    onActivate(id: string): void;
    onClose(id: string): void;
    onViewChange(id: string, view: TableViewMode): void;
    /* Without a connection to run in, the console action is off. */
    canOpenConsole: boolean;
    onNewConsole(): void;
    onOpenConnections(): void;
}

function iconOf(tab: WorkTab): LucideIcon {
    switch (tab.kind) {
        case 'table':
            return Table;
        case 'console':
            return SquareTerminal;
        case 'designer':
            return PencilRuler;
        case 'connections':
            return Cable;
    }
}

/* The tab strip with its actions, and the view of every open tab. */
export function Workspace({
    connections,
    onConnectionsChange,
    onBrowse,
    tabs,
    activeId,
    onActivate,
    onClose,
    onViewChange,
    canOpenConsole,
    onNewConsole,
    onOpenConnections
}: WorkspaceProps) {
    const { t } = useTranslation();
    /* Ids of the table tabs with changes nobody submitted, and the tab a person asked to close while it has them. */
    const [dirty, setDirty] = useState<ReadonlySet<string>>(() => new Set());
    const [closing, setClosing] = useState<string | null>(null);
    const active = tabs.find((tab) => tab.id === activeId);

    const requestClose = (id: string): void => {
        if (dirty.has(id)) {
            setClosing(id);
            return;
        }
        onClose(id);
    };

    const markDirty = (id: string, isDirty: boolean): void => {
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
    };

    const titleOf = (tab: WorkTab): string => {
        switch (tab.kind) {
            case 'table':
                return tab.where === undefined ? tab.ref.table : t('tabs.filtered', { table: tab.ref.table });
            case 'console':
                return `${t('tabs.console')} ${tab.number}`;
            case 'designer':
                return tab.table === undefined ? t('tabs.newTable') : t('tabs.designer', { table: tab.table });
            case 'connections':
                return t('connections.title');
        }
    };

    const viewOf = (tab: WorkTab) => {
        const connectionId = connectionIdOf(tab);
        const connection = connectionId === null ? null : connections.find((entry) => entry.id === connectionId);

        switch (tab.kind) {
            case 'table':
                return (
                    connection && (
                        <TableTab
                            connection={connection}
                            tableRef={tab.ref}
                            view={tab.view}
                            where={tab.where}
                            onDirtyChange={(isDirty) => markDirty(tab.id, isDirty)}
                        />
                    )
                );
            case 'console':
                return connection && <QueryConsole connection={connection} schema={tab.schema} defaultValue={tab.sql} autoFocus className="h-full" />;
            case 'designer':
                return connection && <TableDesigner connection={connection} schema={tab.schema} table={tab.table} className="h-full" />;
            case 'connections':
                return <ConnectionManager value={connections} onValueChange={onConnectionsChange} onBrowse={onBrowse} className="h-full" />;
        }
    };

    return (
        <Tabs.Root value={activeId} onValueChange={(id) => onActivate(String(id))} className="flex h-full min-h-0 flex-col">
            <Tabs.List
                aria-label={t('tabs.label')}
                className="px-3"
                end={
                    <>
                        {active?.kind === 'table' && (
                            <Segmented
                                label={t('tabs.views')}
                                value={active.view}
                                onValueChange={(view) => onViewChange(active.id, view)}
                                options={[
                                    { id: 'data', label: t('views.data'), icon: Table },
                                    { id: 'structure', label: t('views.structure'), icon: TableProperties }
                                ]}
                            />
                        )}
                        <IconButton icon={Cable} size="sm" label={t('connections.title')} onClick={onOpenConnections} />
                        <IconButton icon={SquareTerminal} size="sm" label={t('tabs.newConsole')} disabled={!canOpenConsole} onClick={onNewConsole} />
                    </>
                }
            >
                {tabs.map((tab) => (
                    <Tabs.Tab key={tab.id} value={tab.id} onClose={() => requestClose(tab.id)}>
                        <Icon icon={iconOf(tab)} size={14} />
                        {titleOf(tab)}
                    </Tabs.Tab>
                ))}
            </Tabs.List>
            {tabs.length === 0 ? (
                <EmptyState
                    icon={SquareTerminal}
                    title={t('empty.title')}
                    className="flex-1"
                    action={
                        <Button variant="secondary" disabled={!canOpenConsole} onClick={onNewConsole}>
                            {t('empty.console')}
                        </Button>
                    }
                >
                    {t('empty.body')}
                </EmptyState>
            ) : (
                tabs.map((tab) => (
                    <Tabs.Panel key={tab.id} value={tab.id} keepMounted className="min-h-0 flex-1">
                        {viewOf(tab)}
                    </Tabs.Panel>
                ))
            )}
            <PromptDialog
                open={closing !== null}
                danger
                title={t('tabs.discard.title')}
                description={t('tabs.discard.description')}
                confirmLabel={t('tabs.discard.confirm')}
                onConfirm={() => {
                    if (closing !== null) {
                        setDirty((current) => new Set([...current].filter((id) => id !== closing)));
                        onClose(closing);
                    }
                    setClosing(null);
                }}
                onOpenChange={(open) => {
                    if (!open) {
                        setClosing(null);
                    }
                }}
            />
        </Tabs.Root>
    );
}
