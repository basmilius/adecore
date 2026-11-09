import { Pill, Table } from '@adecore/ui';

const CLIENTS = [
    { name: 'Build server', key: 'ci-runner-7f3a', scopes: ['read', 'write'], muted: false },
    { name: 'Phone', key: 'phone-2c91', scopes: ['read'], muted: false },
    { name: 'Old laptop', key: 'laptop-0b44', scopes: ['revoked'], muted: true }
];

const COLUMNS = [{ width: 'minmax(0,1fr)' }, { width: 'auto', hideBelow: 'sm' }] as const;

export default function TableRichDemo() {
    return (
        <Table.Root label="Clients" columns={COLUMNS} framed className="w-full max-w-md">
            <Table.Head>
                <Table.Column>Client</Table.Column>
                <Table.Column>Access</Table.Column>
            </Table.Head>
            {CLIENTS.map((client) => (
                <Table.Row key={client.key} muted={client.muted}>
                    <Table.Cell>
                        <div className="min-w-0">
                            <div className="truncate">{client.name}</div>
                            <div className="truncate font-mono text-code text-text-muted">{client.key}</div>
                        </div>
                    </Table.Cell>
                    <Table.Cell>
                        {client.scopes.map((scope) => (
                            <Pill key={scope} size="sm" tone={scope === 'revoked' ? 'error' : 'muted'}>
                                {scope}
                            </Pill>
                        ))}
                    </Table.Cell>
                </Table.Row>
            ))}
        </Table.Root>
    );
}
