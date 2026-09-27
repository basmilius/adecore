import { Ellipsis } from 'lucide-react';
import { DisabledReason, IconButton, Menu } from '@basmilius/react-ui';

const pushReason = (): string | null => 'Nothing to push: the branch has no commits the remote lacks.';

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
