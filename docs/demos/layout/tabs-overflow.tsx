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

/* A pane a person can drag narrower and wider by its corner, to watch tabs move into the menu and back. */
export default function TabsOverflowDemo() {
    const [view, setView] = useState('preview');

    return (
        <div className="w-80 max-w-full min-w-40 resize-x overflow-hidden rounded-lg border border-border bg-surface">
            <Tabs.Root value={view} onValueChange={setView}>
                <Tabs.List aria-label="Message views" className="px-3">
                    {VIEWS.map((entry) => (
                        <Tabs.Tab key={entry.id} value={entry.id}>
                            {entry.label}
                            <Tabs.Count value={entry.count} />
                        </Tabs.Tab>
                    ))}
                </Tabs.List>
                <p className="p-3 text-xs text-text-muted">Drag the corner of this pane to make it wider or narrower.</p>
            </Tabs.Root>
        </div>
    );
}
