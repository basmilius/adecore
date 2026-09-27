import { ClipboardPaste, Copy, Scissors } from 'lucide-react';
import { ContextMenu, EDIT_SHORTCUTS, Icon, Kbd } from '@basmilius/react-ui';

export default function ContextMenuDemo() {
    return (
        <ContextMenu.Root>
            <ContextMenu.Trigger className="grid h-40 w-full max-w-md place-items-center rounded-lg border border-dashed border-border-strong text-xs text-text-muted">
                Right-click anywhere in here
            </ContextMenu.Trigger>
            <ContextMenu.Popup>
                <ContextMenu.Item>
                    <Icon icon={Scissors} size={14} /> Cut <Kbd shortcut={EDIT_SHORTCUTS.cut} />
                </ContextMenu.Item>
                <ContextMenu.Item>
                    <Icon icon={Copy} size={14} /> Copy <Kbd shortcut={EDIT_SHORTCUTS.copy} />
                </ContextMenu.Item>
                <ContextMenu.Item>
                    <Icon icon={ClipboardPaste} size={14} /> Paste <Kbd shortcut={EDIT_SHORTCUTS.paste} />
                </ContextMenu.Item>
                <ContextMenu.Separator />
                <ContextMenu.SubmenuRoot>
                    <ContextMenu.SubmenuTrigger>New</ContextMenu.SubmenuTrigger>
                    <ContextMenu.Popup>
                        <ContextMenu.Item>File</ContextMenu.Item>
                        <ContextMenu.Item>Folder</ContextMenu.Item>
                    </ContextMenu.Popup>
                </ContextMenu.SubmenuRoot>
            </ContextMenu.Popup>
        </ContextMenu.Root>
    );
}
