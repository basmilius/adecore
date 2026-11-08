import { Table, type TableSort } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import { useState } from 'react';

const MODELS = [
    { name: 'Large', requests: 1204, tokens: 3_840_000 },
    { name: 'Medium', requests: 4410, tokens: 2_115_500 },
    { name: 'Small', requests: 9870, tokens: 905_300 }
];

type Key = 'requests' | 'tokens';

const COLUMNS = [{ width: 'minmax(0,1fr)' }, { width: 'auto', align: 'end' }, { width: 'auto', align: 'end' }] as const;

export default function TableSortableDemo() {
    const [order, setOrder] = useState<{ key: Key; direction: 'asc' | 'desc' }>({ key: 'tokens', direction: 'desc' });
    const rows = MODELS.toSorted((left, right) => (order.direction === 'asc' ? 1 : -1) * (left[order.key] - right[order.key]));
    const sortOf = (key: Key): TableSort => (order.key === key ? order.direction : 'none');

    return (
        <Table.Root label="Usage per model" columns={COLUMNS} framed className="w-full max-w-md">
            <Table.Head>
                <Table.Column>Model</Table.Column>
                <Table.Column sort={sortOf('requests')} onSort={(direction) => setOrder({ key: 'requests', direction })}>
                    Requests
                </Table.Column>
                <Table.Column sort={sortOf('tokens')} onSort={(direction) => setOrder({ key: 'tokens', direction })}>
                    Tokens
                </Table.Column>
            </Table.Head>
            {rows.map((model) => (
                <Table.Row key={model.name}>
                    <Table.Cell>{model.name}</Table.Cell>
                    <Table.Cell>{formatNumber(model.requests)}</Table.Cell>
                    <Table.Cell>{formatNumber(model.tokens)}</Table.Cell>
                </Table.Row>
            ))}
            <Table.Foot>
                <Table.Cell>Total</Table.Cell>
                <Table.Cell>{formatNumber(MODELS.reduce((sum, model) => sum + model.requests, 0))}</Table.Cell>
                <Table.Cell>{formatNumber(MODELS.reduce((sum, model) => sum + model.tokens, 0))}</Table.Cell>
            </Table.Foot>
        </Table.Root>
    );
}
