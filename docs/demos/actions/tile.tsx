import { FolderOpen, Plus, Terminal } from 'lucide-react';
import { Icon, Tile, shortcut } from '@basmilius/react-ui';

const NEW = shortcut('Mod+N');
const OPEN = shortcut('Mod+O');

export default function TileDemo() {
    return (
        <div className="grid w-full max-w-xl grid-cols-2 gap-2">
            <Tile primary icon={<Icon icon={Plus} />} title="New project" description="Start from an empty folder" shortcut={NEW} />
            <Tile icon={<Icon icon={FolderOpen} />} title="Open a folder" description="Anything on this computer" shortcut={OPEN} />
            <Tile icon={<Icon icon={Terminal} />} title="Open a terminal" size="sm" />
            <Tile icon={<Icon icon={Terminal} />} title="Waiting for a connection" description="Try again once it is back" disabled size="sm" />
        </div>
    );
}
