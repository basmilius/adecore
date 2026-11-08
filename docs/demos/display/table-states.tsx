import { Table } from '@adecore/ui';

const COLUMNS = [{ width: 'minmax(0,2fr)' }, { width: 'minmax(0,1fr)' }, { width: 'auto', align: 'end' }] as const;

function Head() {
    return (
        <Table.Head>
            <Table.Column>Name</Table.Column>
            <Table.Column>Owner</Table.Column>
            <Table.Column>Size</Table.Column>
        </Table.Head>
    );
}

export default function TableStatesDemo() {
    return (
        <div className="grid w-full max-w-xl gap-4 sm:grid-cols-2">
            <Table.Root label="Shared folders" columns={COLUMNS} framed>
                <Head />
                <Table.Empty>Nothing shared yet</Table.Empty>
            </Table.Root>
            <Table.Root label="Shared folders" columns={COLUMNS} framed>
                <Head />
                <Table.Loading rows={3} />
            </Table.Root>
        </div>
    );
}
