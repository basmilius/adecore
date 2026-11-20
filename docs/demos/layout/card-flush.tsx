import { Card, Table } from '@adecore/ui';

const COLUMNS = [{ width: 'minmax(0,1fr)' }, { width: 'auto' }, { width: 'auto' }] as const;

const APPS = [
    { name: 'Desktop', sessions: '18,204', crashFree: '99.4%' },
    { name: 'Phone', sessions: '6,311', crashFree: '98.7%' },
    { name: 'Daemon', sessions: '1,208', crashFree: '99.9%' }
];

export default function CardFlushDemo() {
    return (
        <Card.Root className="w-full max-w-md">
            <Card.Header title="Crash-free sessions">Last 7 days</Card.Header>
            <Card.Body flush>
                <Table.Root label="Crash-free sessions per app" columns={COLUMNS}>
                    <Table.Head>
                        <Table.Column>App</Table.Column>
                        <Table.Column>Sessions</Table.Column>
                        <Table.Column>Crash-free</Table.Column>
                    </Table.Head>
                    {APPS.map((app) => (
                        <Table.Row key={app.name}>
                            <Table.Cell>{app.name}</Table.Cell>
                            <Table.Cell>{app.sessions}</Table.Cell>
                            <Table.Cell>{app.crashFree}</Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Root>
            </Card.Body>
        </Card.Root>
    );
}
