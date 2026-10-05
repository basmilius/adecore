import { useState } from 'react';
import { ConnectionForm, type Connection } from '@adecore/database';
import { ShopDatabase } from '../shared/database.tsx';
import { SHOP_CONNECTIONS } from '../shared/shop.ts';

export default function ConnectionFormDemo() {
    const [connection, setConnection] = useState<Connection>(SHOP_CONNECTIONS[1]!);

    return (
        <ShopDatabase>
            <ConnectionForm value={connection} onValueChange={setConnection} className="w-full max-w-xl" />
        </ShopDatabase>
    );
}
