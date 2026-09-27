import { Bold, Italic, Link, List, ListOrdered } from 'lucide-react';
import { ButtonGroup, IconButton, Separator } from '@basmilius/react-ui';

export default function SeparatorDemo() {
    return (
        <div className="flex w-72 flex-col gap-3">
            <div className="flex items-center gap-2">
                <ButtonGroup>
                    <IconButton icon={Bold} label="Bold" size="sm" />
                    <IconButton icon={Italic} label="Italic" size="sm" />
                </ButtonGroup>
                <Separator />
                <ButtonGroup>
                    <IconButton icon={List} label="Bulleted list" size="sm" />
                    <IconButton icon={ListOrdered} label="Numbered list" size="sm" />
                </ButtonGroup>
                <Separator />
                <IconButton icon={Link} label="Link" size="sm" />
            </div>
            <Separator orientation="horizontal" />
            <p className="text-xs text-text-muted">A horizontal separator runs the full width.</p>
        </div>
    );
}
