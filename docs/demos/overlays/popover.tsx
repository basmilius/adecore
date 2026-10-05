import { Bell } from 'lucide-react';
import { Button, IconButton, Popover } from '@adecore/ui';

export default function PopoverDemo() {
    return (
        <Popover.Root>
            <IconButton icon={Bell} label="Notifications" render={<Popover.Trigger />} />
            <Popover.Popup className="w-72 p-3">
                <Popover.Title className="text-sm font-medium text-text">Notifications</Popover.Title>
                <Popover.Description className="mt-1 text-xs text-text-muted">Nothing new since you last looked.</Popover.Description>
                <div className="mt-3 flex justify-end">
                    <Popover.Close render={<Button size="sm" variant="secondary" />}>Close</Popover.Close>
                </div>
            </Popover.Popup>
        </Popover.Root>
    );
}
