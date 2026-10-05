import { useState } from 'react';
import { Plus } from 'lucide-react';
import { IconButton, Tabs } from '@adecore/ui';

interface Query {
    readonly id: number;
    readonly name: string;
}

export default function TabsClosableDemo() {
    const [queries, setQueries] = useState<readonly Query[]>([
        { id: 1, name: 'Orders' },
        { id: 2, name: 'Customers' },
        { id: 3, name: 'Revenue' }
    ]);
    const [picked, setPicked] = useState<number>(1);
    const [next, setNext] = useState(4);

    function add(): void {
        setQueries([...queries, { id: next, name: `Query ${next}` }]);
        setPicked(next);
        setNext(next + 1);
    }

    function close(id: number): void {
        const at = queries.findIndex((query) => query.id === id);
        const rest = queries.filter((query) => query.id !== id);
        setQueries(rest);
        if (picked === id) {
            setPicked(rest[Math.min(at, rest.length - 1)]?.id ?? 0);
        }
    }

    return (
        <Tabs.Root value={picked} onValueChange={(value) => setPicked(Number(value))} className="w-full max-w-md rounded-lg border border-border bg-surface">
            <Tabs.List aria-label="Queries" className="px-3" end={<IconButton icon={Plus} size="sm" label="New query" onClick={add} />}>
                {queries.map((query) => (
                    <Tabs.Tab key={query.id} value={query.id} onClose={() => close(query.id)}>
                        {query.name}
                    </Tabs.Tab>
                ))}
            </Tabs.List>
            {queries.map((query) => (
                <Tabs.Panel key={query.id} value={query.id} className="p-4 text-xs text-text-muted">
                    The editor of {query.name}.
                </Tabs.Panel>
            ))}
        </Tabs.Root>
    );
}
