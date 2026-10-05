import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseClient } from './client/types.ts';
import { ClientContext } from './client-context.ts';
import { addDatabaseResources } from './locales.ts';

export interface DatabaseProviderProps {
    client: DatabaseClient;
    children: ReactNode;
}

/* Hands every view below it the client, and adds the package's words to the i18next the app's `UIProvider` was given. Mount it inside that provider. */
export function DatabaseProvider({ client, children }: DatabaseProviderProps) {
    const { i18n } = useTranslation();
    const [added, setAdded] = useState<typeof i18n | null>(null);
    // In render, as `UIProvider` does, so the first view already reads its words.
    if (added !== i18n) {
        addDatabaseResources(i18n);
        setAdded(i18n);
    }

    return <ClientContext value={client}>{children}</ClientContext>;
}
