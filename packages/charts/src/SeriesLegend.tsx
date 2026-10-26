import { useId, useState, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { Check, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Tooltip } from '@adecore/ui';
import { matchingItems, toggleGroup } from './legend.ts';

export interface SeriesLegendItem {
    readonly key: string;
    readonly label: string;
    /* The full name a screen reader and the hint give, such as with the name of its group; `label` by default. */
    readonly name?: string;
    /* The key of the group it is listed under. */
    readonly group?: string;
    /* A CSS color of the app's own, such as a variable; the mark and the check take it. */
    readonly color?: string;
    /* A series that has nothing to show: listed, but it cannot be turned on. */
    readonly disabled?: boolean;
    /* Why the series shows less than it could, such as "Turned off", under its name and in its hint. */
    readonly status?: string;
}

export interface SeriesLegendGroup {
    readonly key: string;
    readonly label: string;
}

export interface SeriesLegendProps<Item extends SeriesLegendItem> {
    readonly items: readonly Item[];
    /* The groups in their order; an item whose group is not among them is left out. Without groups the items stand in one list. */
    readonly groups?: readonly SeriesLegendGroup[];
    /* The name of the list for a screen reader. */
    readonly label: string;
    /* The keys of the series that are turned off. */
    readonly hidden: readonly string[];
    readonly onHiddenChange: (hidden: string[]) => void;
    /* The series the pointer or the focus is on, which the chart brings forward; a hidden one is never highlighted. */
    readonly highlighted?: string | null;
    readonly onHighlightedChange?: (key: string | null) => void;
    /* Drawn before the name, such as a logo in the color of the series. */
    readonly mark?: (item: Item) => ReactNode;
    /* Controls the search; the legend keeps its own without it. */
    readonly query?: string;
    readonly onQueryChange?: (query: string) => void;
    /* The placeholder and the name of the search field; false leaves the field out. */
    readonly search?: string | false;
    /* What the list says when the search finds nothing. */
    readonly empty?: string;
    /* The height of a row: `sm` 28px, `md` 36px for a touch screen. */
    readonly size?: 'sm' | 'md';
    readonly className?: string;
    readonly ref?: Ref<HTMLDivElement>;
}

/*
 * A legend of many series beside a chart: a search, groups that turn on or off as a whole, a toggle per series and a
 * highlight while the pointer or the focus is on one. It only reports; what turning a series off means stays with the app.
 */
export function SeriesLegend<Item extends SeriesLegendItem>({
    items,
    groups,
    label,
    hidden,
    onHiddenChange,
    highlighted,
    onHighlightedChange,
    mark,
    query: queryProp,
    onQueryChange,
    search,
    empty,
    size = 'sm',
    className,
    ref
}: SeriesLegendProps<Item>) {
    const { t } = useTranslation('charts');
    const id = useId();
    const [ownQuery, setOwnQuery] = useState('');
    const query = queryProp ?? ownQuery;
    const off = new Set(hidden);
    const shown = matchingItems(items, query);

    const sections =
        groups === undefined ? [{ key: '', label: null as string | null }] : groups.map((group) => ({ key: group.key, label: group.label as string | null }));

    const searchLabel = search === undefined ? t('legend.search') : search;

    const setQuery = (next: string): void => {
        if (queryProp === undefined) {
            setOwnQuery(next);
        }

        onQueryChange?.(next);
    };

    const toggle = (key: string): void => onHiddenChange(off.has(key) ? hidden.filter((entry) => entry !== key) : [...hidden, key]);

    const highlight = (key: string | null): void => {
        if (key !== highlighted) {
            onHighlightedChange?.(key);
        }
    };

    return (
        <div ref={ref} className={clsx('flex min-h-0 flex-col gap-3', className)}>
            {searchLabel !== false && (
                <Input icon={Search} size="sm" aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={(e) => setQuery(e.target.value)} />
            )}
            <div role="group" aria-label={label} className="flex min-h-0 flex-col gap-4">
                {sections.map((section) => {
                    const own = shown.filter((item) => groups === undefined || item.group === section.key);

                    if (own.length === 0) {
                        return null;
                    }

                    const members = items.filter((item) => item.group === section.key && item.disabled !== true);
                    const allOn = members.every((item) => !off.has(item.key));

                    return (
                        <div key={section.key} className="flex flex-col">
                            {section.label !== null && (
                                <div className="mb-1 flex items-center justify-between px-1 text-xs">
                                    <span className="font-medium text-text">{section.label}</span>
                                    {members.length > 0 && (
                                        <Button size="sm" variant="ghost" onClick={() => onHiddenChange(toggleGroup(items, hidden, section.key, !allOn))}>
                                            {allOn ? t('legend.none') : t('legend.all')}
                                        </Button>
                                    )}
                                </div>
                            )}
                            {own.map((item) => {
                                const on = item.disabled !== true && !off.has(item.key);
                                const statusId = `${id}-${item.key}`;
                                const color = item.color ?? 'var(--text-muted)';
                                const name = item.name ?? item.label;

                                return (
                                    <Tooltip key={item.key} label={item.status ?? name} side="left">
                                        <button
                                            type="button"
                                            aria-label={name}
                                            aria-pressed={on}
                                            aria-describedby={item.status === undefined ? undefined : statusId}
                                            disabled={item.disabled === true}
                                            className={clsx(
                                                'flex w-full items-center gap-2 rounded px-1 text-left text-xs enabled:hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent',
                                                size === 'md' ? 'min-h-9' : 'min-h-7',
                                                on ? 'text-text' : 'text-text-faint'
                                            )}
                                            onClick={() => toggle(item.key)}
                                            onPointerEnter={() => highlight(on ? item.key : null)}
                                            onPointerLeave={() => highlight(null)}
                                            onFocus={() => highlight(on ? item.key : null)}
                                            onBlur={() => highlight(null)}
                                        >
                                            {mark !== undefined && (
                                                <span aria-hidden className={clsx('flex shrink-0', !on && 'opacity-40')} style={{ color }}>
                                                    {mark(item)}
                                                </span>
                                            )}
                                            <span className="min-w-0 grow py-1">
                                                <span className="block truncate">{item.label}</span>
                                                {item.status !== undefined && (
                                                    <span id={statusId} className="mt-0.5 block text-2xs text-text-muted">
                                                        {item.status}
                                                    </span>
                                                )}
                                            </span>
                                            <span aria-hidden className="flex size-3 shrink-0 items-center justify-center" style={{ color }}>
                                                {on ? <Check size={12} /> : <span className="size-1.5 rounded-full border border-current opacity-40" />}
                                            </span>
                                        </button>
                                    </Tooltip>
                                );
                            })}
                        </div>
                    );
                })}
                {shown.length === 0 && <p className="px-1 py-3 text-xs text-text-muted">{empty ?? t('legend.empty')}</p>}
            </div>
        </div>
    );
}
