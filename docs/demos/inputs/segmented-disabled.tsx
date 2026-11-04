import { Segmented } from '@adecore/ui';
import { useState } from 'react';

type Resolution = 'minute' | 'hour' | 'day';

export default function SegmentedDisabledDemo() {
    const [resolution, setResolution] = useState<Resolution>('hour');

    return (
        <Segmented<Resolution>
            label="Resolution"
            value={resolution}
            onValueChange={setResolution}
            options={[
                { id: 'minute', label: 'Per minute', disabled: true },
                { id: 'hour', label: 'Per hour' },
                { id: 'day', label: 'Per day' }
            ]}
        />
    );
}
