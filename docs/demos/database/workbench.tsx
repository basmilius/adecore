import { useState } from 'react';
import { DatabaseWorkbench, type Connection } from '@adecore/database';
import { ShopDatabase } from '../shared/database.tsx';
import { SHOP_CONNECTIONS } from '../shared/shop.ts';

export default function WorkbenchDemo() {
    const [connections, setConnections] = useState<readonly Connection[]>(SHOP_CONNECTIONS);

    return (
        <ShopDatabase>
            <div className="flex h-128 w-full overflow-hidden rounded-lg border border-border bg-surface">
                <DatabaseWorkbench connections={connections} onConnectionsChange={setConnections} className="min-w-0 flex-1" />
            </div>
        </ShopDatabase>
    );
}
