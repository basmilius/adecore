import { useState } from 'react';
import { Select } from '@basmilius/react-ui';

type Theme = 'system' | 'light' | 'dark';

export default function SelectDemo() {
    const [theme, setTheme] = useState<Theme>('system');
    const [sort, setSort] = useState<string | null>(null);

    return (
        <div className="flex flex-wrap items-center gap-3">
            <Select<Theme>
                label="Theme"
                value={theme}
                onValueChange={setTheme}
                items={[
                    { value: 'system', label: 'Match the system' },
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' }
                ]}
            />
            <Select
                label="Sort by"
                placeholder="Sort by"
                variant="ghost"
                size="sm"
                value={sort}
                onValueChange={setSort}
                items={[
                    { value: 'name', label: 'Name' },
                    { value: 'modified', label: 'Last modified', description: 'The newest change first' },
                    { value: 'size', label: 'Size', disabled: true }
                ]}
            />
        </div>
    );
}
