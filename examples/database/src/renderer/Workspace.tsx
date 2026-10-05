import { useTranslation } from 'react-i18next';
import { Cable, SquareTerminal, Table, X, type LucideIcon } from 'lucide-react';
import { ConnectionManager, QueryConsole, type Connection } from '@adecore/database';
import { Button, EmptyState, Icon, IconButton, Tabs } from '@adecore/ui';
import { TableTab } from './TableTab.tsx';
import type { TableViewMode, WorkTab } from './useTabs.ts';

export interface WorkspaceProps {
    connections: readonly Connection[];
    onConnectionsChange(next: readonly Connection[]): void;
    onBrowse(): Promise<string | null>;
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

const iconOf = (tab: WorkTab): LucideIcon => {
    switch (tab.kind) {
        case 'table':
            return Table;
        case 'console':
            return SquareTerminal;
        case 'connections':
            return Cable;
    }
};

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

    const titleOf = (tab: WorkTab): string => {
        switch (tab.kind) {
            case 'table':
                return tab.ref.table;
            case 'console':
                return `${t('tabs.console')} ${tab.number}`;
            case 'connections':
                return t('connections.title');
        }
    };

    const viewOf = (tab: WorkTab) => {
        const connection = tab.kind === 'connections' ? null : connections.find((entry) => entry.id === (tab.kind === 'table' ? tab.ref.connectionId : tab.connectionId));

        switch (tab.kind) {
            case 'table':
                return connection && <TableTab connection={connection} tableRef={tab.ref} view={tab.view} onViewChange={(view) => onViewChange(tab.id, view)} />;
            case 'console':
                return connection && <QueryConsole connection={connection} schema={tab.schema} className="h-full" />;
            case 'connections':
                return <ConnectionManager value={connections} onValueChange={onConnectionsChange} onBrowse={onBrowse} className="h-full" />;
        }
    };

    return (
        <Tabs.Root value={activeId} onValueChange={(id) => onActivate(String(id))} className="flex h-full min-h-0 flex-col">
            <div className="flex items-stretch">
                <Tabs.List aria-label={t('tabs.label')} className="min-w-0 flex-1 px-3">
                    {tabs.map((tab) => (
                        <Tabs.Tab key={tab.id} value={tab.id} nativeButton={false} render={<div />}>
                            <Icon icon={iconOf(tab)} size={14} />
                            {titleOf(tab)}
                            <IconButton
                                icon={X}
                                size="2xs"
                                label={t('tabs.close')}
                                tabIndex={-1}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose(tab.id);
                                }}
                            />
                        </Tabs.Tab>
                    ))}
                </Tabs.List>
                <div className="flex items-center gap-1 border-b border-border px-2">
                    <IconButton icon={Cable} size="sm" label={t('connections.title')} onClick={onOpenConnections} />
                    <IconButton icon={SquareTerminal} size="sm" label={t('tabs.newConsole')} disabled={!canOpenConsole} onClick={onNewConsole} />
                </div>
            </div>
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
        </Tabs.Root>
    );
}
