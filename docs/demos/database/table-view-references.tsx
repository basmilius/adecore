import { useState } from 'react';
import { TableView, type DatabaseAction } from '@adecore/database';
import { ShopDatabase } from '../shared/database.tsx';
import { SHOP } from '../shared/shop.ts';

export default function TableViewReferencesDemo() {
    const [action, setAction] = useState<DatabaseAction | null>(null);

    return (
        <ShopDatabase onAction={setAction}>
            <div className="flex w-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
                <div className="flex h-80">
                    <TableView connection={SHOP} schema="main" table="orders" className="min-w-0 flex-1" />
                </div>
                <p className="border-t border-border px-3 py-2 text-xs text-text-muted">
                    {action?.kind === 'open-table'
                        ? `Open ${action.ref.table} where ${action.where ?? 'true'}.`
                        : 'Right click a customer_id and pick Go to referenced row.'}
                </p>
            </div>
        </ShopDatabase>
    );
}
