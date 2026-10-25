import { Icon, Menu } from '@adecore/ui';
import type { HostMenuAction } from '../../host';

/* The items a host adds to a menu of the chat's, in the order it gave them. */
export function HostMenuItems({ actions }: { actions: readonly HostMenuAction[] }) {
    return actions.map((action) => (
        <Menu.Item key={action.id} disabled={action.disabled} onClick={() => action.run()}>
            {action.icon !== undefined && <Icon icon={action.icon} size={14} />} {action.label}
        </Menu.Item>
    ));
}
