import { TableView } from '@adecore/database';
import { ShopDatabase } from '../shared/database.tsx';
import { SHOP_READ_ONLY } from '../shared/shop.ts';

export default function TableViewReadOnlyDemo() {
    return (
        <ShopDatabase>
            <div className="flex h-80 w-full overflow-hidden rounded-lg border border-border bg-surface">
                <TableView connection={SHOP_READ_ONLY} schema="main" table="orders" className="min-w-0 flex-1" />
            </div>
        </ShopDatabase>
    );
}
