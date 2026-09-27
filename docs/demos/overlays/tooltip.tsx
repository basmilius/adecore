import { Info, Search } from 'lucide-react';
import { Button, Icon, Tooltip, shortcut } from '@basmilius/react-ui';

const SEARCH = shortcut('Mod+K');

export default function TooltipDemo() {
    return (
        <div className="flex items-center gap-3">
            <Tooltip label="Search everything" kbd={SEARCH}>
                <Button variant="secondary">
                    <Icon icon={Search} size={14} />
                    Search
                </Button>
            </Tooltip>
            <Tooltip label="Reload" kbd="Shift skips the cache" side="bottom">
                <Button variant="secondary">Reload</Button>
            </Tooltip>
            <Tooltip label="About this view" name side="right">
                <button type="button" className="focus-ring grid size-6 place-items-center rounded-md text-text-muted">
                    <Icon icon={Info} size={14} />
                </button>
            </Tooltip>
        </div>
    );
}
