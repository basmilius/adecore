import { Download } from 'lucide-react';
import { Button, Icon } from '@basmilius/react-ui';

export default function ButtonSizes() {
    return (
        <div className="flex items-center gap-2">
            <Button variant="secondary" size="xs">
                Extra small
            </Button>
            <Button variant="secondary" size="sm">
                <Icon icon={Download} size={14} />
                Small
            </Button>
            <Button variant="secondary">
                <Icon icon={Download} size={14} />
                Medium
            </Button>
            <Button variant="secondary" disabled>
                Disabled
            </Button>
            <Button variant="secondary" href="https://github.com/basmilius/react-ui">
                A link
            </Button>
        </div>
    );
}
