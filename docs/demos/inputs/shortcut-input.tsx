import { ShortcutInput, shortcut, type Shortcut } from '@adecore/ui';
import { useState } from 'react';

const needsModifier = (next: Shortcut): string | null => (next.mod || next.ctrl || next.meta || next.alt ? null : 'Needs Cmd, Ctrl or Alt');

export default function ShortcutInputDemo() {
    const [palette, setPalette] = useState(shortcut('Mod+K'));
    const [sidebar, setSidebar] = useState(shortcut('Mod+B'));

    return (
        <div className="flex w-72 flex-col gap-2 text-sm text-text">
            <div className="flex items-center justify-between gap-4">
                Open the palette
                <ShortcutInput label="Shortcut for Open the palette" value={palette} onChange={setPalette} validate={needsModifier} />
            </div>
            <div className="flex items-center justify-between gap-4">
                Toggle the sidebar
                <ShortcutInput label="Shortcut for Toggle the sidebar" value={sidebar} onChange={setSidebar} validate={needsModifier} />
            </div>
        </div>
    );
}
