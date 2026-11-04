import { IconButton, Input } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import { Search, X } from 'lucide-react';
import { useState } from 'react';

const FILES = ['Button.tsx', 'ButtonGroup.tsx', 'Input.tsx', 'Select.tsx', 'SplitButton.tsx'];

export default function InputEndDemo() {
    const [query, setQuery] = useState('button');
    const matches = FILES.filter((name) => name.toLowerCase().includes(query.toLowerCase())).length;

    return (
        <div className="w-80">
            <Input
                icon={Search}
                size="sm"
                aria-label="Filter files"
                placeholder="Filter files"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                end={
                    query !== '' && (
                        <>
                            <span className="text-xs text-text-faint tabular-nums">{formatNumber(matches)}</span>
                            <IconButton icon={X} size="xs" label="Clear filter" onClick={() => setQuery('')} />
                        </>
                    )
                }
            />
        </div>
    );
}
