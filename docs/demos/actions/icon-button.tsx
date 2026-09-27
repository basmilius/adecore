import { useState } from 'react';
import { Bold, Italic, RefreshCw, Settings, Trash } from 'lucide-react';
import { ButtonGroup, IconButton, Separator, shortcut } from '@basmilius/react-ui';

const REFRESH = shortcut('Mod+R');

export default function IconButtonDemo() {
    const [bold, setBold] = useState(true);
    const [italic, setItalic] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

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
            <IconButton icon={RefreshCw} label="Refresh" kbd={REFRESH} spin={refreshing} onClick={refresh} />
            <IconButton icon={Settings} label="Settings" tooltipSide="bottom" />
            <IconButton icon={Trash} label="Delete" tooltip="Nothing is selected" aria-disabled />
        </div>
    );
}
