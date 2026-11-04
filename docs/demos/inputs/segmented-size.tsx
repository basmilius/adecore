import { Button, Input, Segmented, Select } from '@adecore/ui';
import { Search } from 'lucide-react';
import { useState } from 'react';

type Status = 'open' | 'resolved' | 'ignored';
type Sort = 'recent' | 'frequent';

export default function SegmentedSizeDemo() {
    const [status, setStatus] = useState<Status>('open');
    const [sort, setSort] = useState<Sort>('recent');

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Segmented<Status>
                label="Status"
                size="sm"
                value={status}
                onValueChange={setStatus}
                options={[
                    { id: 'open', label: 'Open' },
                    { id: 'resolved', label: 'Resolved' },
                    { id: 'ignored', label: 'Ignored' }
                ]}
            />
            <Input size="sm" icon={Search} aria-label="Search" placeholder="Search" className="w-40" />
            <Select<Sort>
                label="Sort"
                size="sm"
                value={sort}
                onValueChange={setSort}
                items={[
                    { value: 'recent', label: 'Most recent' },
                    { value: 'frequent', label: 'Most frequent' }
                ]}
            />
            <Button size="sm" variant="secondary">
                Clear
            </Button>
        </div>
    );
}
