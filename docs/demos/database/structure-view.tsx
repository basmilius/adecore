import { StructureView } from '@adecore/database';
import { ShopDatabase } from '../shared/database.tsx';
import { SHOP } from '../shared/shop.ts';

export default function StructureViewDemo() {
    return (
        <ShopDatabase>
            <div className="flex h-80 w-full overflow-hidden rounded-lg border border-border bg-surface">
                <StructureView connection={SHOP} schema="main" table="orders" className="min-w-0 flex-1" />
            </div>
        </ShopDatabase>
    );
}
