import { useState } from 'react';
import { DatabaseProvider, useDatabaseClient, type Connection, type DatabaseAction, type ExplorerSelection } from '@adecore/database';
import { databaseFiles, databaseStorage } from './app-hooks.ts';
import { Sidebar } from './Sidebar.tsx';
import { connectionIdOf, useTabs } from './useTabs.ts';
import { Workspace } from './Workspace.tsx';

export interface SidePaneProps {
    connections: readonly Connection[];
    onConnectionsChange(next: readonly Connection[]): void;
}

/* The explorer in a side pane and the app's own tabs beside it, the way an app that already has tabs of its own would place the views. */
export function SidePane({ connections, onConnectionsChange }: SidePaneProps) {
    const client = useDatabaseClient();
    const [selected, setSelected] = useState<ExplorerSelection | null>(null);
    const workspace = useTabs();

    const activeTab = workspace.tabs.find((tab) => tab.id === workspace.activeId);
    const consoleConnectionId = (activeTab && connectionIdOf(activeTab)) ?? selected?.connectionId ?? connections[0]?.id;

    const changeConnections = (next: readonly Connection[]): void => {
        onConnectionsChange(next);
        workspace.keepConnections(new Set(next.map((connection) => connection.id)));
    };

    const openConsole = (): void => {
        if (consoleConnectionId !== undefined) {
            workspace.openConsole(consoleConnectionId, selected?.connectionId === consoleConnectionId ? selected.schema : undefined);
        }
    };

    /* What a view asks for lands as a tab of the app, beside its own. */
    const onAction = (action: DatabaseAction): void => {
        switch (action.kind) {
            case 'open-table':
                workspace.openTable(action.ref, action.view, action.where);
                break;
            case 'open-console':
                workspace.openConsole(action.connectionId, action.schema, action.sql);
                break;
            case 'new-table':
                workspace.openDesigner(action.connectionId, action.schema);
                break;
            case 'edit-table':
                workspace.openDesigner(action.ref.connectionId, action.ref.schema, action.ref.table);
                break;
            case 'manage-connection':
                workspace.openConnections();
                break;
        }
    };

    return (
        <DatabaseProvider client={client} onAction={onAction} storage={databaseStorage} files={databaseFiles}>
            <div className="flex h-full">
                <Sidebar
                    connections={connections}
                    onConnectionsChange={changeConnections}
                    onBrowse={window.database.browse}
                    selected={selected}
                    onSelectedChange={setSelected}
                />
                <main className="min-w-0 flex-1 bg-surface">
                    <Workspace
                        connections={connections}
                        onConnectionsChange={changeConnections}
                        onBrowse={window.database.browse}
                        tabs={workspace.tabs}
                        activeId={workspace.activeId}
                        onActivate={workspace.activate}
                        onClose={workspace.close}
                        onViewChange={workspace.setView}
                        canOpenConsole={consoleConnectionId !== undefined}
                        onNewConsole={openConsole}
                        onOpenConnections={workspace.openConnections}
                    />
                </main>
            </div>
        </DatabaseProvider>
    );
}
