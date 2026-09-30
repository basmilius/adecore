import { useState } from 'react';
import { CircleAlert, GitBranch } from 'lucide-react';
import { Icon, Pill } from '@basmilius/desktop-ui';

export default function PillDemo() {
    const [staged, setStaged] = useState(false);

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <Pill>12 files</Pill>
                <Pill tone="raised">Draft</Pill>
                <Pill tone="idle">Idle</Pill>
                <Pill tone="needsYou" icon={<Icon icon={CircleAlert} size={12} />}>
                    Needs you
                </Pill>
                <Pill tone="error">Failed</Pill>
                <Pill tone="accent">New</Pill>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Pill mono icon={<Icon icon={GitBranch} size={12} />}>
                    feature/export
                </Pill>
                <Pill shape="tag" tone="accent">
                    Beta
                </Pill>
                <Pill pressed={staged} onClick={() => setStaged(!staged)}>
                    Staged only
                </Pill>
            </div>
        </div>
    );
}
