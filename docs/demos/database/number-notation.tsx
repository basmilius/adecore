import { useEffect, useState } from 'react';
import { Segmented, type SegmentedOption } from '@adecore/ui';
import { DatabaseProvider, TableView, type NumberNotation } from '@adecore/database';
import { PreferencesBar } from '../shared/preferences-bar.tsx';
import { createShopClient, SHOP } from '../shared/shop.ts';

const NOTATIONS: readonly SegmentedOption<NumberNotation>[] = [
    { id: 'database', label: 'Database' },
    { id: 'region', label: 'Region' }
];

export default function NumberNotationDemo() {
    const [client] = useState(createShopClient);
    const [notation, setNotation] = useState<NumberNotation>('database');

    useEffect(() => () => void client.dispose(), [client]);

    return (
        <div className="flex w-full flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <Segmented<NumberNotation> label="Number notation" value={notation} onValueChange={setNotation} options={NOTATIONS} />
                <PreferencesBar />
            </div>
            <DatabaseProvider client={client} numberNotation={notation}>
                <div className="flex h-72 w-full overflow-hidden rounded-lg border border-border bg-surface">
                    <TableView connection={SHOP} schema="main" table="products" className="min-w-0 flex-1" />
                </div>
            </DatabaseProvider>
        </div>
    );
}
