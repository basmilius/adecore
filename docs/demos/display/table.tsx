import { IconButton, Menu, Switch, Table } from '@adecore/ui';
import { Ellipsis } from 'lucide-react';
import { useState } from 'react';

const GROUPS = [
    {
        label: 'Production',
        hosts: [
            { name: 'shop.example.com', target: 'localhost:3000' },
            { name: 'api.example.com', target: 'localhost:8080' }
        ]
    },
    {
        label: 'Staging',
        hosts: [{ name: 'staging.example.com', target: 'localhost:3001' }]
    }
];

const COLUMNS = [{ width: 'minmax(0,2fr)' }, { width: 'minmax(0,1fr)', hideBelow: 'md' }, { width: 'auto' }, { width: 'auto' }] as const;

export default function TableDemo() {
    const [live, setLive] = useState<Record<string, boolean>>({ 'shop.example.com': true, 'api.example.com': true });

    return (
        <div className="w-full max-w-xl rounded-xl border border-border bg-surface">
            <Table.Root label="Hostnames" columns={COLUMNS}>
                <Table.Head>
                    <Table.Column>Hostname</Table.Column>
                    <Table.Column>Points to</Table.Column>
                    <Table.Column>Live</Table.Column>
                    <Table.Column>
                        <span className="sr-only">Actions</span>
                    </Table.Column>
                </Table.Head>
                {GROUPS.map((group) => (
                    <Table.Group key={group.label} label={group.label}>
                        {group.hosts.map((host) => (
                            <Table.Row key={host.name}>
                                <Table.Cell>{host.name}</Table.Cell>
                                <Table.Cell mono>{host.target}</Table.Cell>
                                <Table.Cell>
                                    <Switch
                                        label={`Serve ${host.name}`}
                                        checked={live[host.name] ?? false}
                                        onCheckedChange={(checked) => setLive((current) => ({ ...current, [host.name]: checked }))}
                                    />
                                </Table.Cell>
                                <Table.Cell>
                                    <Menu.Root>
                                        <IconButton icon={Ellipsis} label={`Actions for ${host.name}`} size="xs" render={<Menu.Trigger />} />
                                        <Menu.Popup align="end">
                                            <Menu.Item>Copy address</Menu.Item>
                                            <Menu.Item>Remove</Menu.Item>
                                        </Menu.Popup>
                                    </Menu.Root>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Group>
                ))}
            </Table.Root>
        </div>
    );
}
