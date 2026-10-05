import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createDatabaseClient, DatabaseProvider, DatabaseWorkbench } from '@adecore/database';
import { Segmented, Select, type SelectItem } from '@adecore/ui';
import { FORMAT_LANGUAGE, FORMAT_REGION_CHOICES, FORMAT_SYSTEM, regionName } from '@adecore/ui/format';
import { databaseFiles, databaseStorage, useLayout, useNumberNotation, useRegion } from './app-hooks.ts';
import { SidePane } from './SidePane.tsx';
import { useConnections } from './useConnections.ts';

export function App() {
    const { t, i18n } = useTranslation();
    const [client] = useState(() => createDatabaseClient(window.database.request));
    const [connections, saveConnections] = useConnections();
    const [layout, setLayout] = useLayout();
    const [region, setRegion] = useRegion();
    const [numberNotation, setNumberNotation] = useNumberNotation();
    const regionItems = FORMAT_REGION_CHOICES.map((choice): SelectItem<string> => {
        if (choice === FORMAT_LANGUAGE) {
            return { value: choice, label: t('format.language') };
        }
        return { value: choice, label: choice === FORMAT_SYSTEM ? t('format.system') : regionName(choice, i18n.language) };
    });

    return (
        <DatabaseProvider client={client} storage={databaseStorage} files={databaseFiles} numberNotation={numberNotation}>
            <div className="flex h-screen flex-col bg-bg text-text">
                <header className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
                    <h1 className="text-sm font-semibold text-text">{t('title')}</h1>
                    <div className="flex items-center gap-3">
                        <Select size="sm" label={t('format.region')} value={region} items={regionItems} align="end" onValueChange={setRegion} />
                        <Segmented
                            label={t('format.notation')}
                            value={numberNotation}
                            onValueChange={setNumberNotation}
                            options={[
                                { id: 'database', label: t('format.database') },
                                { id: 'region', label: t('format.regional') }
                            ]}
                        />
                        <Segmented
                            label={t('layout.label')}
                            value={layout}
                            onValueChange={setLayout}
                            options={[
                                { id: 'workbench', label: t('layout.workbench') },
                                { id: 'pane', label: t('layout.pane') }
                            ]}
                        />
                    </div>
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
