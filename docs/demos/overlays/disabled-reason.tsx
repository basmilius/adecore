import { DisabledReason, IconButton, Menu } from '@adecore/ui';
import { Ellipsis } from 'lucide-react';

function pushReason(): string | null {
    return 'Nothing to push: the branch has no commits the remote lacks.';
}

export default function DisabledReasonDemo() {
    return (
        <Menu.Root>
            <IconButton icon={Ellipsis} label="Branch actions" render={<Menu.Trigger />} />
            <Menu.Popup>
                <DisabledReason reason={null}>
                    <Menu.Item>Pull</Menu.Item>
                </DisabledReason>
                <DisabledReason reason={pushReason()}>
                    <Menu.Item disabled>Push</Menu.Item>
                </DisabledReason>
            </Menu.Popup>
        </Menu.Root>
    );
}
