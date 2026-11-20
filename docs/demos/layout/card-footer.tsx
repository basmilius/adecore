import { Card, IconButton, Table } from '@adecore/ui';
import { RefreshCw } from 'lucide-react';

const COLUMNS = [{ width: 'minmax(0,1fr)' }, { width: 'auto' }] as const;

const CLIENTS = [
    { bundle: 'com.example.music', state: 'playing' },
    { bundle: 'com.example.podcasts', state: 'paused' }
];

export default function CardFooterDemo() {
    return (
        <Card.Root className="w-full max-w-md">
            <Card.Header title="Clients">
                <IconButton icon={RefreshCw} label="Refresh" size="sm" />
            </Card.Header>
            <Card.Body flush>
                <Table.Root label="Clients" columns={COLUMNS}>
                    <Table.Head>
                        <Table.Column>Bundle</Table.Column>
                        <Table.Column>State</Table.Column>
                    </Table.Head>
                    {CLIENTS.map((client) => (
                        <Table.Row key={client.bundle}>
                            <Table.Cell mono>{client.bundle}</Table.Cell>
                            <Table.Cell>{client.state}</Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Root>
            </Card.Body>
            <Card.Footer>
                2 of 14 clients
                <a href="#clients" className="ml-auto hover:text-text">
                    View all
                </a>
            </Card.Footer>
        </Card.Root>
    );
}
