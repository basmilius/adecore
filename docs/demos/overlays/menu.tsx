import { useState } from 'react';
import { Copy, Ellipsis, FolderInput, Pencil, Trash } from 'lucide-react';
import { EDIT_SHORTCUTS, Icon, IconButton, KEY_SHORTCUTS, Kbd, Menu } from '@basmilius/desktop-ui';

export default function MenuDemo() {
    const [wrap, setWrap] = useState(true);
    const [sort, setSort] = useState('name');

    return (
        <Menu.Root>
            <IconButton icon={Ellipsis} label="More" render={<Menu.Trigger />} />
            <Menu.Popup>
                <Menu.Item>
                    <Icon icon={Pencil} size={14} /> Rename <Kbd shortcut={KEY_SHORTCUTS.rename} />
                </Menu.Item>
                <Menu.Item>
                    <Icon icon={Copy} size={14} /> Copy path <Kbd shortcut={EDIT_SHORTCUTS.copy} />
                </Menu.Item>
                <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger>
                        <Icon icon={FolderInput} size={14} /> Move to
                    </Menu.SubmenuTrigger>
                    <Menu.Popup>
                        <Menu.Item>Documents</Menu.Item>
                        <Menu.Item>
                            Archive <Menu.Hint>Read only</Menu.Hint>
                        </Menu.Item>
                        <Menu.Item disabled>Shared</Menu.Item>
                    </Menu.Popup>
                </Menu.SubmenuRoot>
                <Menu.Separator />
                <Menu.CheckboxItem checked={wrap} onCheckedChange={setWrap}>
                    Wrap lines
                </Menu.CheckboxItem>
                <Menu.Group>
                    <Menu.GroupLabel>Sort by</Menu.GroupLabel>
                    <Menu.RadioGroup value={sort} onValueChange={setSort}>
                        <Menu.RadioItem value="name">Name</Menu.RadioItem>
                        <Menu.RadioItem value="modified">Last modified</Menu.RadioItem>
                    </Menu.RadioGroup>
                </Menu.Group>
                <Menu.Separator />
                <Menu.Item>
                    <Icon icon={Trash} size={14} /> Delete
                </Menu.Item>
            </Menu.Popup>
        </Menu.Root>
    );
}
