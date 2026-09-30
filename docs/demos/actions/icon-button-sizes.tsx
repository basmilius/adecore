import { Plus } from 'lucide-react';
import { IconButton } from '@basmilius/desktop-ui';

export default function IconButtonSizes() {
    return (
        <div className="flex items-center gap-3">
            <IconButton icon={Plus} label="Add (32, icon 16)" />
            <IconButton icon={Plus} label="Add (28, icon 14)" size="sm" />
            <IconButton icon={Plus} label="Add (24, icon 12)" size="xs" />
            <IconButton icon={Plus} label="Add (20, icon 12)" size="2xs" />
            <IconButton icon={Plus} label="Add a file" className="w-auto gap-1.5 px-2 text-xs">
                Add
            </IconButton>
        </div>
    );
}
