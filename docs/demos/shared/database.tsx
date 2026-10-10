import { useEffect, useState, type ReactNode } from 'react';
import { DatabaseProvider, type DatabaseAction, type DatabaseStorage } from '@adecore/database';
import { createShopClient } from './shop.ts';

/* Where an app would keep console history, column widths and open tabs; here it lasts until the page reloads. */
function createStorage(): DatabaseStorage {
    const values = new Map<string, string>();

    return {
        get: (key) => values.get(key) ?? null,
        set: (key, value) => {
            if (value === null) {
                values.delete(key);
            } else {
                values.set(key, value);
            }
        }
    };
}

/* What an app puts around the views once. A demo gets its own database, so an edit in one never shows in another. */
export function ShopDatabase({ onAction, children }: { onAction?(action: DatabaseAction): void; children: ReactNode }) {
    const [client] = useState(createShopClient);
    const [storage] = useState(createStorage);

    useEffect(() => () => void client.dispose(), [client]);

    return (
        <DatabaseProvider client={client} storage={storage} onAction={onAction}>
            {children}
        </DatabaseProvider>
    );
}
