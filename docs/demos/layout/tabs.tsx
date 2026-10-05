import { useState } from 'react';
import { Tabs } from '@adecore/ui';

const VIEWS = [
    { id: 'preview', label: 'Preview', count: 0 },
    { id: 'text', label: 'Plain text', count: 0 },
    { id: 'source', label: 'HTML source', count: 0 },
    { id: 'headers', label: 'Headers', count: 24 },
    { id: 'links', label: 'Links', count: 12 },
    { id: 'attachments', label: 'Attachments', count: 2 },
    { id: 'checks', label: 'Checks', count: 3 },
    { id: 'raw', label: 'Raw', count: 0 }
];

export default function TabsDemo() {
    const [view, setView] = useState('links');

    return (
        <Tabs.Root value={view} onValueChange={setView} className="w-full max-w-3xl rounded-lg border border-border bg-surface">
            <Tabs.List aria-label="Message views" className="px-4">
                {VIEWS.map((entry) => (
                    <Tabs.Tab key={entry.id} value={entry.id}>
                        {entry.label}
                        <Tabs.Count value={entry.count} />
                    </Tabs.Tab>
                ))}
            </Tabs.List>
            {VIEWS.map((entry) => (
                <Tabs.Panel key={entry.id} value={entry.id} className="p-4 text-xs text-text-muted">
                    {entry.count === 0 ? `${entry.label} of the message.` : `${entry.count} ${entry.label.toLowerCase()} in the message.`}
                </Tabs.Panel>
            ))}
        </Tabs.Root>
    );
}
