import { FilePlus, FolderOpen, Save } from 'lucide-react';
import { ButtonGroup, IconButton, ShortcutHints, shortcut } from '@adecore/ui';

const NEW = shortcut('Mod+N');
const OPEN = shortcut('Mod+O');
const SAVE = shortcut('Mod+S');

export default function ShortcutHintsDemo() {
    return (
        <>
            <ButtonGroup>
                <IconButton icon={FilePlus} label="New file" kbd={NEW} />
                <IconButton icon={FolderOpen} label="Open" kbd={OPEN} />
                <IconButton icon={Save} label="Save" kbd={SAVE} />
            </ButtonGroup>
            <ShortcutHints />
        </>
    );
}
