import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createDatabaseClient, DatabaseProvider, DatabaseWorkbench } from '@adecore/database';
import { Segmented } from '@adecore/ui';
import { databaseFiles, databaseStorage, useLayout } from './app-hooks.ts';
import { SidePane } from './SidePane.tsx';
import { useConnections } from './useConnections.ts';

export function App() {
    const { t } = useTranslation();
    const [client] = useState(() => createDatabaseClient(window.database.request));
    const [connections, saveConnections] = useConnections();
    const [layout, setLayout] = useLayout();

    return (
        <DatabaseProvider client={client} storage={databaseStorage} files={databaseFiles}>
            <div className="flex h-screen flex-col bg-bg text-text">
                <header className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
                    <h1 className="text-sm font-semibold text-text">{t('title')}</h1>
                    <Segmented
                        label={t('layout.label')}
                        value={layout}
                        onValueChange={setLayout}
                        options={[
                            { id: 'workbench', label: t('layout.workbench') },
                            { id: 'pane', label: t('layout.pane') }
                        ]}
                    />
                </header>
                <div className="min-h-0 flex-1">
                    {layout === 'workbench' ? (
                        <DatabaseWorkbench connections={connections} onConnectionsChange={saveConnections} />
                    ) : (
                        <SidePane connections={connections} onConnectionsChange={saveConnections} />
                    )}
                </div>
            </div>
        </DatabaseProvider>
    );
}
