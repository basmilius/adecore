import { Checkbox, Table } from '@adecore/ui';
import { useState } from 'react';

const PROJECTS = ['Atlas', 'Beacon', 'Cobalt', 'Delta', 'Ember', 'Fjord', 'Granite', 'Harbor', 'Iris', 'Juniper'].map((name) => ({
    name,
    folder: `~/Projects/${name.toLowerCase()}`
}));

const COLUMNS = [{ width: 'auto' }, { width: 'minmax(0,1fr)' }, { width: 'minmax(0,2fr)', hideBelow: 'sm' }] as const;

export default function TableSelectionDemo() {
    const [picked, setPicked] = useState<ReadonlySet<string>>(new Set(['Beacon']));

    const toggle = (name: string) => {
        setPicked((current) => {
            const next = new Set(current);

            if (!next.delete(name)) {
                next.add(name);
            }

            return next;
        });
    };

    const all = picked.size === PROJECTS.length;

    return (
        <Table.Root label="Projects" columns={COLUMNS} density="compact" framed maxHeight={220} className="w-full max-w-md">
            <Table.Head>
                <Table.Column>
                    <Checkbox
                        label="Pick every project"
                        checked={all}
                        indeterminate={picked.size > 0 && !all}
                        onCheckedChange={(checked) => setPicked(new Set(checked ? PROJECTS.map((project) => project.name) : []))}
                    />
                </Table.Column>
                <Table.Column>Project</Table.Column>
                <Table.Column>Folder</Table.Column>
            </Table.Head>
            {PROJECTS.map((project) => (
                <Table.Row key={project.name} selected={picked.has(project.name)} onClick={() => toggle(project.name)}>
                    <Table.Cell>
                        <Checkbox label={`Pick ${project.name}`} checked={picked.has(project.name)} onCheckedChange={() => toggle(project.name)} />
                    </Table.Cell>
                    <Table.Cell>{project.name}</Table.Cell>
                    <Table.Cell mono>{project.folder}</Table.Cell>
                </Table.Row>
            ))}
        </Table.Root>
    );
}
