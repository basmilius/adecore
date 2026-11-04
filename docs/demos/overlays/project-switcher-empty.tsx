import { Button, Icon, Menu, ProjectSwitcher, type ProjectSwitcherItem } from '@adecore/ui';
import { Box, Plus } from 'lucide-react';
import { useState } from 'react';

const PRODUCTS: ProjectSwitcherItem[] = [
    { id: 'website', name: 'Website', icon: <Icon icon={Box} size={16} /> },
    { id: 'mobile', name: 'Mobile app', icon: <Icon icon={Box} size={16} /> }
];

export default function ProjectSwitcherEmptyDemo() {
    const [current, setCurrent] = useState<ProjectSwitcherItem | null>(null);

    return (
        <div className="flex items-center gap-3">
            <ProjectSwitcher label="Product" current={current} projects={PRODUCTS} onSelect={setCurrent}>
                <Menu.Item>
                    <Icon icon={Plus} size={14} /> New product
                </Menu.Item>
            </ProjectSwitcher>
            <Button size="sm" variant="secondary" disabled={current === null} onClick={() => setCurrent(null)}>
                Leave the product
            </Button>
        </div>
    );
}
