import { useState } from 'react';
import { Select } from '@basmilius/desktop-ui';

export default function SelectGroups() {
    const [font, setFont] = useState<string | null>('jetbrains');

    return (
        <Select
            label="Font"
            value={font}
            onValueChange={setFont}
            items={[
                {
                    label: 'Monospace',
                    items: [
                        { value: 'jetbrains', label: 'JetBrains Mono' },
                        { value: 'sf-mono', label: 'SF Mono' }
                    ]
                },
                {
                    label: 'Proportional',
                    items: [
                        { value: 'inter', label: 'Inter' },
                        { value: 'system', label: 'System font' }
                    ]
                }
            ]}
        />
    );
}
