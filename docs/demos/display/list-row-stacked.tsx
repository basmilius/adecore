import { ListRow } from '@adecore/ui';
import { useState } from 'react';

const FOLDERS = [
    { id: 'all', label: 'All inboxes', indent: 0 },
    { id: 'personal', label: 'Personal', indent: 1 },
    { id: 'work', label: 'Work', indent: 1 }
];

const MESSAGES = [
    {
        id: 1,
        from: 'Sanne de Vries',
        time: '09:41',
        subject: 'Review requested: new onboarding flow',
        preview: 'I left notes on the second and fourth screen. The empty state could use a drawing.'
    },
    {
        id: 2,
        from: 'Jan Dekker',
        time: 'Tue',
        subject: 'Re: Q1 roadmap planning',
        preview: 'Sounds good, I will bring the slides. Can we decide on the sync engine before Friday?'
    }
];

export default function ListRowStacked() {
    const [folder, setFolder] = useState('personal');
    const [message, setMessage] = useState(1);

    return (
        <div className="flex w-full max-w-xl gap-4">
            <div className="flex w-44 shrink-0 flex-col gap-0.5 rounded-lg border border-border bg-surface p-1">
                {FOLDERS.map((entry) => (
                    <ListRow
                        key={entry.id}
                        variant="inset"
                        indent={entry.indent}
                        selected={folder === entry.id}
                        className="text-sm"
                        render={<button type="button" onClick={() => setFolder(entry.id)} />}
                    >
                        {entry.label}
                    </ListRow>
                ))}
            </div>
            <div className="flex min-w-0 grow flex-col gap-0.5 rounded-lg border border-border bg-surface p-1">
                {MESSAGES.map((entry) => (
                    <ListRow
                        key={entry.id}
                        variant="stacked"
                        selected={message === entry.id}
                        render={<button type="button" onClick={() => setMessage(entry.id)} />}
                    >
                        <span className="flex items-center gap-2 text-xs font-semibold">
                            <span className="truncate">{entry.from}</span>
                            <span className="ml-auto font-normal text-text-faint">{entry.time}</span>
                        </span>
                        <span className="truncate text-xs">{entry.subject}</span>
                        <span className="line-clamp-2 text-xs text-text-muted">{entry.preview}</span>
                    </ListRow>
                ))}
            </div>
        </div>
    );
}
