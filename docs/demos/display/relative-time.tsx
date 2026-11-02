import { useState } from 'react';
import { RelativeTime } from '@adecore/ui';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ROWS: { name: string; ago: number | null }[] = [
    { name: 'Deploy to production', ago: 20_000 },
    { name: 'Rotate the signing key', ago: 7 * MINUTE },
    { name: 'Nightly backup', ago: 5 * HOUR },
    { name: 'Release 2.4.0', ago: 3 * DAY },
    { name: 'Migrate the archive', ago: 40 * DAY },
    { name: 'First sign-in', ago: null }
];

export default function RelativeTimeDemo() {
    const [now] = useState(Date.now);

    return (
        <ul className="flex w-full max-w-80 flex-col gap-1.5 text-sm">
            {ROWS.map((row) => (
                <li key={row.name} className="flex items-center justify-between gap-4">
                    <span className="text-text">{row.name}</span>
                    <RelativeTime at={row.ago === null ? null : now - row.ago} className="text-xs text-text-faint tabular-nums" />
                </li>
            ))}
        </ul>
    );
}
