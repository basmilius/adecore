import { useState } from 'react';
import { CircleAlert, GitMerge } from 'lucide-react';
import { Banner, Button } from '@basmilius/desktop-ui';

export default function BannerDemo() {
    const [resolved, setResolved] = useState(false);

    return (
        <div className="relative flex h-48 w-full items-end justify-center rounded-lg bg-surface-sunken p-4">
            {resolved ? (
                <Banner icon={CircleAlert} tone="neutral" message="The merge finished." />
            ) : (
                <Banner icon={GitMerge} tone="attention" message="Two files have conflicts.">
                    <Button size="sm" variant="primary" onClick={() => setResolved(true)}>
                        Resolve
                    </Button>
                    <Button size="sm">Abort</Button>
                </Banner>
            )}
            <Button size="sm" variant="secondary" onClick={() => setResolved(false)}>
                Start over
            </Button>
        </div>
    );
}
