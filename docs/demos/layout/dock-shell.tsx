import { useState } from 'react';
import { Hand, MousePointer2, Square, Type } from 'lucide-react';
import { ButtonGroup, DockShell, IconButton, Separator, Switch } from '@basmilius/desktop-ui';

const TOOLS = [
    { id: 'select', label: 'Select', icon: MousePointer2 },
    { id: 'pan', label: 'Pan', icon: Hand },
    { id: 'box', label: 'Box', icon: Square },
    { id: 'text', label: 'Text', icon: Type }
];

export default function DockShellDemo() {
    const [tool, setTool] = useState('select');
    const [autoHide, setAutoHide] = useState(false);

    return (
        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-surface-sunken">
            <label className="absolute top-3 left-3 flex items-center gap-2 text-xs text-text-muted">
                <Switch label="Hide the dock" checked={autoHide} onCheckedChange={setAutoHide} />
                Hide until the pointer comes down
            </label>
            <DockShell autoHide={autoHide}>
                <ButtonGroup>
                    {TOOLS.map((entry) => (
                        <IconButton key={entry.id} icon={entry.icon} label={entry.label} active={tool === entry.id} onClick={() => setTool(entry.id)} />
                    ))}
                </ButtonGroup>
                <Separator />
                <span className="px-2 text-xs text-text-muted">{TOOLS.find((entry) => entry.id === tool)?.label}</span>
            </DockShell>
        </div>
    );
}
