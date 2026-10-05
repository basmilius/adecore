import { useState } from 'react';
import { Database, Table } from 'lucide-react';
import { Icon, Tree } from '@adecore/ui';

export default function TreeDemo() {
    const [expanded, setExpanded] = useState(true);
    const [selected, setSelected] = useState('customers');
    return (
        <Tree.Root aria-label="Database objects" className="w-72 py-2">
            <Tree.Row selected={selected === 'store'} aria-expanded={expanded} tabIndex={0} onClick={() => setSelected('store')}>
                <Tree.Chevron expanded={expanded} onExpandedChange={setExpanded} />
                <Icon icon={Database} size={16} className="text-text-muted" />
                <Tree.Label>Store</Tree.Label>
            </Tree.Row>
            {expanded &&
                ['customers', 'orders'].map((name) => (
                    <Tree.Row key={name} level={2} selected={selected === name} tabIndex={-1} onClick={() => setSelected(name)}>
                        <Tree.ChevronSlot />
                        <Icon icon={Table} size={16} className="text-text-muted" />
                        <Tree.Label>{name}</Tree.Label>
                    </Tree.Row>
                ))}
        </Tree.Root>
    );
}
