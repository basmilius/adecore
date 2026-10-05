import { useEffect, useState } from 'react';
import { DatabaseProvider, TableView } from '@adecore/database';
import { createShopClient, SHOP } from '../shared/shop.ts';
import { DEMO_FILES, withDemoFiles } from './demo-files.ts';

export default function TableViewFilesDemo() {
    const [client] = useState(() => withDemoFiles(createShopClient()));

    useEffect(() => () => void client.dispose(), [client]);

    return (
        <DatabaseProvider client={client} files={DEMO_FILES}>
            <div className="flex h-80 w-full overflow-hidden rounded-lg border border-border bg-surface">
                <TableView connection={SHOP} schema="main" table="customers" className="min-w-0 flex-1" />
            </div>
        </DatabaseProvider>
    );
}
