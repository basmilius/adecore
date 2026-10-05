import { useState } from 'react';
import { ConnectionManager, type Connection } from '@adecore/database';
import { ShopDatabase } from '../shared/database.tsx';
import { SHOP_CONNECTIONS } from '../shared/shop.ts';

export default function ConnectionManagerDemo() {
    const [connections, setConnections] = useState<readonly Connection[]>(SHOP_CONNECTIONS);

    return (
        <ShopDatabase>
            <div className="flex h-96 w-full overflow-hidden rounded-lg border border-border bg-surface">
                <ConnectionManager value={connections} onValueChange={setConnections} className="min-w-0 flex-1" />
            </div>
        </ShopDatabase>
    );
}
