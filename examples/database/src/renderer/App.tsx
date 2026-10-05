import { useState } from 'react';
import { createDatabaseClient, DatabaseProvider, type Connection, type TableRef } from '@adecore/database';
import { Sidebar } from './Sidebar.tsx';
import { connectionIdOf, useTabs } from './useTabs.ts';
import { useConnections } from './useConnections.ts';
import { Workspace } from './Workspace.tsx';

export function App() {
    const [client] = useState(() => createDatabaseClient(window.database.request));
    const [connections, saveConnections] = useConnections();
    const [selected, setSelected] = useState<TableRef | null>(null);
    const workspace = useTabs();

    const activeTab = workspace.tabs.find((tab) => tab.id === workspace.activeId);
    const consoleConnectionId = (activeTab && connectionIdOf(activeTab)) ?? selected?.connectionId ?? connections[0]?.id;

    const changeConnections = (next: readonly Connection[]): void => {
        saveConnections(next);
        workspace.keepConnections(new Set(next.map((connection) => connection.id)));
    };

    const openConsole = (): void => {
        if (consoleConnectionId !== undefined) {
            workspace.openConsole(consoleConnectionId, selected?.connectionId === consoleConnectionId ? selected.schema : undefined);
        }
    };

    return (
        <DatabaseProvider client={client}>
            <div className="flex h-screen bg-bg text-text">
                <Sidebar
                    connections={connections}
                    onConnectionsChange={changeConnections}
                    onBrowse={window.database.browse}
                    selected={selected}
                    onSelectedChange={setSelected}
                    onOpenTable={workspace.openTable}
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
