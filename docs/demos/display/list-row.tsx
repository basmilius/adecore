import { GitCommitHorizontal } from 'lucide-react';
import { Icon, ListRow } from '@basmilius/desktop-ui';

const COMMITS = [
    { hash: 'a1c9e2f', message: 'Keep a nested dialog above its parent' },
    { hash: '4d02b7a', message: 'Round the spacing unit to a whole pixel' },
    { hash: '9fe13c0', message: 'Let a select align with the end of its trigger' }
];

export default function ListRowDemo() {
    return (
        <div className="flex w-full max-w-xl gap-4">
            <div className="flex w-48 shrink-0 flex-col gap-0.5 rounded-lg border border-border bg-surface p-1">
                <ListRow variant="inset" className="bg-surface-active text-sm text-text" render={<button type="button" />}>
                    Inbox
                </ListRow>
                <ListRow variant="inset" className="text-sm text-text-muted hover:bg-surface-hover" render={<button type="button" />}>
                    Archive
                </ListRow>
            </div>
            <div className="min-w-0 grow divide-y divide-border-soft rounded-lg border border-border bg-surface">
                {COMMITS.map((commit) => (
                    <ListRow key={commit.hash} variant="flat" className="gap-2 px-3 text-xs text-text">
                        <Icon icon={GitCommitHorizontal} size={14} className="text-text-faint" />
                        <span className="font-mono text-text-muted">{commit.hash}</span>
                        <span className="truncate">{commit.message}</span>
                    </ListRow>
                ))}
            </div>
        </div>
    );
}
