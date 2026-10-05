import { useState } from 'react';
import { Eye, Link, Paperclip, ShieldCheck } from 'lucide-react';
import { Icon, Tabs } from '@adecore/ui';

export default function TabsIconsDemo() {
    const [view, setView] = useState('preview');

    return (
        <Tabs.Root value={view} onValueChange={setView} className="w-full max-w-md">
            <Tabs.List aria-label="Message views">
                <Tabs.Tab value="preview">
                    <Icon icon={Eye} size={14} /> Preview
                </Tabs.Tab>
                <Tabs.Tab value="links">
                    <Icon icon={Link} size={14} /> Links
                    <Tabs.Count value={12} />
                </Tabs.Tab>
                <Tabs.Tab value="attachments">
                    <Icon icon={Paperclip} size={14} /> Attachments
                    <Tabs.Count value={2} />
                </Tabs.Tab>
                <Tabs.Tab value="checks" disabled>
                    <Icon icon={ShieldCheck} size={14} /> Checks
                </Tabs.Tab>
            </Tabs.List>
        </Tabs.Root>
    );
}
