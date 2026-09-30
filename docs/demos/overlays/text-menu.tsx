import { Quote } from 'lucide-react';
import { ContextMenu, Icon, TextMenu } from '@basmilius/desktop-ui';

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
            Select a few words and right-click them. The menu offers to copy what is selected inside this block, and to select all of it, on Cmd+A as well while
            the block has the focus.
        </TextMenu>
    );
}
