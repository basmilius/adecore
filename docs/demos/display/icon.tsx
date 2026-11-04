import { Icon } from '@adecore/ui';
import { Folder } from 'lucide-react';

export default function IconDemo() {
    return (
        <div className="flex items-end gap-6 text-text-muted">
            {[12, 14, 16, 20].map((size) => (
                <span key={size} className="flex flex-col items-center gap-2 text-xs">
                    <Icon icon={Folder} size={size} />
                    {size}
                </span>
            ))}
        </div>
    );
}
