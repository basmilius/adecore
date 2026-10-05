import { TableDesigner } from '@adecore/database';
import { ShopDatabase } from '../shared/database.tsx';
import { SHOP } from '../shared/shop.ts';

export default function TableDesignerDemo() {
    return (
        <ShopDatabase>
            <div className="flex h-128 w-full overflow-hidden rounded-lg border border-border bg-surface">
                <TableDesigner connection={SHOP} schema="main" table="orders" className="min-w-0 flex-1" />
            </div>
        </ShopDatabase>
    );
}
