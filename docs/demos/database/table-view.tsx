import { TableView } from '@adecore/database';
import { ShopDatabase } from '../shared/database.tsx';
import { SHOP } from '../shared/shop.ts';

export default function TableViewDemo() {
    return (
        <ShopDatabase>
            <div className="flex h-96 w-full overflow-hidden rounded-lg border border-border bg-surface">
                <TableView connection={SHOP} schema="main" table="customers" className="min-w-0 flex-1" />
            </div>
        </ShopDatabase>
    );
}
