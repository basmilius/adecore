import { useState } from 'react';
import { Bold, ChevronRight, Italic, RefreshCw, Settings, Trash } from 'lucide-react';
import { ButtonGroup, IconButton, Separator, shortcut } from '@basmilius/desktop-ui';

const REFRESH = shortcut('Mod+R');

export default function IconButtonDemo() {
    const [bold, setBold] = useState(true);
    const [italic, setItalic] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [open, setOpen] = useState(false);

    const refresh = (): void => {
        setRefreshing(true);
        window.setTimeout(() => setRefreshing(false), 1200);
    };

    return (
        <div className="flex items-center gap-2">
            <ButtonGroup>
                <IconButton icon={Bold} label="Bold" aria-pressed={bold} onClick={() => setBold(!bold)} />
                <IconButton icon={Italic} label="Italic" aria-pressed={italic} onClick={() => setItalic(!italic)} />
            </ButtonGroup>
            <Separator />
            <IconButton icon={RefreshCw} label="Refresh" kbd={REFRESH} busy={refreshing} onClick={refresh} />
            <IconButton
                icon={ChevronRight}
                label={open ? 'Collapse' : 'Expand'}
                aria-expanded={open}
                iconClassName={open ? 'rotate-90 transition-transform' : 'transition-transform'}
                onClick={() => setOpen(!open)}
            />
            <IconButton icon={Settings} label="Settings" tooltipSide="bottom" />
            <IconButton icon={Trash} label="Delete" tooltip="Nothing is selected" aria-disabled />
        </div>
    );
}
