import { useState, type Ref } from 'react';
import clsx from 'clsx';
import { Check, CircleAlert, Search, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Icon, IconButton, Input, isApplePlatform, isModHeld } from '@adecore/ui';
import { formatMoment, formatNumber } from '@adecore/ui/format';
import { searchHistory, type HistoryEntry } from './history.ts';

export interface HistoryPanelProps {
    entries: readonly HistoryEntry[];
    /* Clicking puts the SQL in the editor, and Mod+click or a double click runs it as well. */
    onPick(entry: HistoryEntry, run: boolean): void;
    onClear(): void;
    className?: string;
    ref?: Ref<HTMLElement>;
}

/* The runs of this connection, newest first, with a search over their SQL. */
export function HistoryPanel({ entries, onPick, onClear, className, ref }: HistoryPanelProps) {
    const { t } = useTranslation('database');
    const [query, setQuery] = useState('');
    const shown = searchHistory(entries, query);

    return (
        <aside ref={ref} aria-label={t('console.history.title')} className={clsx('flex w-72 shrink-0 flex-col border-l border-border', className)}>
            <div className="flex shrink-0 items-center gap-2 p-2">
                <Input
                    size="sm"
                    type="search"
                    icon={Search}
                    className="min-w-0 flex-1"
                    aria-label={t('console.history.search')}
                    placeholder={t('console.history.search')}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
                <IconButton icon={Trash2} size="sm" label={t('console.history.clear')} disabled={entries.length === 0} onClick={onClear} />
            </div>
            <div className="relative min-h-24 flex-1 border-t border-border">
                {shown.length === 0 ? (
                    <p className="p-3 text-xs text-text-muted">{entries.length === 0 ? t('console.history.empty') : t('console.history.noMatches')}</p>
                ) : (
                    <ul className="absolute inset-0 overflow-auto">
                        {shown.map((entry) => (
                            <li key={`${entry.at}:${entry.sql}`} className="border-b border-border-soft">
                                <button
                                    type="button"
                                    className="flex w-full min-w-0 flex-col gap-0.5 px-3 py-2 text-left hover:bg-surface-hover"
                                    onClick={(event) => onPick(entry, isModHeld(event, isApplePlatform()))}
                                    onDoubleClick={() => onPick(entry, true)}
                                >
                                    <span className="truncate font-mono text-xs text-text">{entry.sql.replace(/\s+/g, ' ')}</span>
                                    <span className="flex items-center gap-1.5 text-xs text-text-muted tabular-nums">
                                        <Icon icon={entry.ok ? Check : CircleAlert} size={12} className={entry.ok ? 'text-positive' : 'text-status-error'} />
                                        {formatMoment(entry.at)}
                                        {entry.rows !== null && t('console.history.rows', { count: entry.rows, formatted: formatNumber(entry.rows) })}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <p className="shrink-0 border-t border-border px-3 py-2 text-xs text-text-faint">{t('console.history.hint')}</p>
        </aside>
    );
}
