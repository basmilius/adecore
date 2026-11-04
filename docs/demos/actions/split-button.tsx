import { Icon, Menu, SplitButton } from '@adecore/ui';
import { ArrowUp, Upload } from 'lucide-react';

export default function SplitButtonDemo() {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <SplitButton
                variant="primary"
                size="sm"
                menuLabel="More ways to commit"
                menu={
                    <Menu.Item>
                        <Icon icon={ArrowUp} size={14} /> Commit and push
                    </Menu.Item>
                }
            >
                Commit
            </SplitButton>
            <SplitButton
                size="sm"
                tooltip="Push 3 commits"
                menuLabel="Push one repository"
                menuClassName="w-56"
                menu={
                    <>
                        <Menu.Item>app</Menu.Item>
                        <Menu.Item disabled>docs</Menu.Item>
                    </>
                }
            >
                <Icon icon={Upload} size={14} /> 3
            </SplitButton>
            <SplitButton size="sm" menuLabel="More" menuDisabled menu={null}>
                Publish
            </SplitButton>
        </div>
    );
}
