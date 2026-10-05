import { useEffect, useState, type ReactNode } from 'react';
import { DatabaseProvider } from '@adecore/database';
import { createShopClient } from './shop.ts';

/* What an app puts around the views once. A demo gets its own database, so an edit in one never shows in another. */
export function ShopDatabase({ children }: { children: ReactNode }) {
    const [client] = useState(createShopClient);

    useEffect(() => () => void client.dispose(), [client]);

    return <DatabaseProvider client={client}>{children}</DatabaseProvider>;
}
