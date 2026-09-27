import { useState } from 'react';
import { ChevronRight, Plus, Settings2 } from 'lucide-react';
import { Button, Icon, IconButton, Menu } from '@basmilius/react-ui';

const DENSITIES = ['Compact', 'Normal', 'Roomy'];

export default function MenuUnstyledDemo() {
    const [density, setDensity] = useState('Normal');
    const [previews, setPreviews] = useState(true);

    return (
        <Menu.Root>
            <Menu.Trigger render={<Button variant="secondary" />}>
                <Icon icon={Settings2} size={14} /> View
            </Menu.Trigger>
            <Menu.Popup className="w-72">
                <div className="flex items-center gap-1 py-0.5 pr-0.5 pl-2.5 text-sm text-text-muted">
                    <span className="grow">Lists</span>
                    <IconButton icon={Plus} size="xs" label="Add a list" render={<Menu.Item unstyled />} />
                </div>
                <Menu.Separator />
                <div className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-text-muted">
                    <span className="grow">Density</span>
                    <Menu.RadioGroup value={density} onValueChange={setDensity} aria-label="Density" className="flex gap-0.5 rounded-md bg-surface-sunken p-0.5">
                        {DENSITIES.map((entry) => (
                            <Menu.RadioItem
                                key={entry}
                                unstyled
                                value={entry}
                                closeOnClick={false}
                                className="focus-ring flex h-6 items-center rounded px-2 text-xs data-checked:bg-surface-active data-checked:text-text data-highlighted:text-text"
                            >
                                {entry}
                            </Menu.RadioItem>
                        ))}
                    </Menu.RadioGroup>
                </div>
                <Menu.CheckboxItem checked={previews} onCheckedChange={setPreviews} closeOnClick={false} indicator="end" className="text-text-muted">
                    <span className="grow">Previews</span>
                </Menu.CheckboxItem>
                <div className="flex justify-end px-2.5 py-1.5 text-xs">
                    <Menu.Item unstyled className="focus-ring flex items-center gap-0.5 rounded font-medium text-accent data-highlighted:underline">
                        All settings <Icon icon={ChevronRight} size={12} />
                    </Menu.Item>
                </div>
            </Menu.Popup>
        </Menu.Root>
    );
}
