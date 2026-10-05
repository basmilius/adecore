import { QueryConsole } from '@adecore/database';
import { ShopDatabase } from '../shared/database.tsx';
import { SHOP } from '../shared/shop.ts';

export default function QueryConsoleDemo() {
    return (
        <ShopDatabase>
            <div className="flex h-96 w-full overflow-hidden rounded-lg border border-border bg-surface">
                <QueryConsole connection={SHOP} schema="main" defaultValue="SELECT * FROM products" className="min-w-0 flex-1" />
            </div>
        </ShopDatabase>
    );
}
