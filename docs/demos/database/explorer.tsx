import { useState } from 'react';
import { DatabaseExplorer, type TableRef } from '@adecore/database';
import { ShopDatabase } from '../shared/database.tsx';
import { SHOP_CONNECTIONS } from '../shared/shop.ts';

export default function ExplorerDemo() {
    const [opened, setOpened] = useState<TableRef | null>(null);

    return (
        <ShopDatabase>
            <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-border bg-surface">
                <DatabaseExplorer connections={SHOP_CONNECTIONS} onOpen={setOpened} className="h-72" />
                <p className="border-t border-border px-3 py-2 text-xs text-text-muted">
                    {opened === null ? 'Double click a table to open it.' : `Opened ${opened.schema}.${opened.table} of ${opened.connectionId}.`}
                </p>
            </div>
        </ShopDatabase>
    );
}
