import { useState } from 'react';
import { FileText } from 'lucide-react';
import { ContextMenu, DocumentTab, Icon, TabStrip, type TabStripItem } from '@adecore/ui';

export default function TabStripDemo() {
    const [items, setItems] = useState<TabStripItem[]>([
        { id: 'readme', label: 'README.md', pinned: true },
        { id: 'index', label: 'index.ts', unsaved: true },
        { id: 'theme', label: 'theme.css' }
    ]);
    const [value, setValue] = useState<string | null>('index');
    return (
        <div className="h-10 w-full overflow-hidden rounded-lg border border-border bg-surface">
            <TabStrip
                items={items.map((item) => ({ ...item, icon: <Icon icon={FileText} size={14} /> }))}
                renderTab={(item) => (
                    <ContextMenu.Root>
                        <ContextMenu.Trigger render={<DocumentTab item={item} />} />
                        <ContextMenu.Popup>
                            <ContextMenu.Item
                                onClick={() =>
                                    setItems(items.map((candidate) => (candidate.id === item.id ? { ...candidate, pinned: !candidate.pinned } : candidate)))
                                }
                            >
                                {item.pinned ? 'Unpin tab' : 'Pin tab'}
                            </ContextMenu.Item>
                        </ContextMenu.Popup>
                    </ContextMenu.Root>
                )}
                value={value}
                onValueChange={setValue}
                onDoubleClick={(id) => setItems(items.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item)))}
                onClose={(id) => {
                    const next = items.filter((item) => item.id !== id);
                    setItems(next);
                    if (value === id) {
                        setValue(next[0]?.id ?? null);
                    }
                }}
            />
        </div>
    );
}
