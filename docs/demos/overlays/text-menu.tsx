import { ContextMenu, Icon, TextMenu } from '@adecore/ui';
import { Quote } from 'lucide-react';

export default function TextMenuDemo() {
    return (
        <TextMenu
            className="max-w-md rounded-lg border border-border bg-surface p-4 text-sm text-text select-text"
            items={
                <ContextMenu.Item>
                    <Icon icon={Quote} size={14} /> Quote in a reply
                </ContextMenu.Item>
            }
        >
            Select a few words and right-click them. The menu copies the selection or selects this whole block. Cmd+A selects the block too while it has focus.
        </TextMenu>
    );
}
