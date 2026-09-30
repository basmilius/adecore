import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import clsx from 'clsx';
import { Ban, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from './EmptyState.tsx';
import { formatNumber } from './format/number.ts';
import { Icon } from './Icon.tsx';
import { IconButton } from './IconButton.tsx';
import { cellForKey, escapeClearsSearch, filterSections, isGrouped, sectionsOf, tabStopOf, type IconPickerIcons } from './icon-picker.ts';
import { SectionLabel } from './SectionLabel.tsx';
import { Tooltip } from './Tooltip.tsx';

export type { IconPickerGroup } from './icon-picker.ts';

/* A row of cells is 28 high with a gap of 4. Under a heading of 28 the last row keeps 8 below it; without headings the grid has 6 above as well. */
const ROW_HEIGHT = 32;
const HEADED_EXTRA = 32;
const BARE_EXTRA = 10;

export interface IconPickerProps {
    /* Every icon on offer by its name, in the order of the grid, or in groups under a heading each. The name is also its tooltip. */
    icons: IconPickerIcons;
    /* The name of the icon as it stands, or null for none. */
    value: string | null;
    onValueChange(name: string): void;
    /* More words a search finds an icon by, beside its name and its group's label, by icon name. */
    keywords?: Readonly<Record<string, readonly string[]>>;
    /* A search field on top of the grid, in one frame with it. On by default for groups, off for a flat set. */
    searchable?: boolean;
    /* The grid as a scroll area this many rows high, with room for a heading. Without it the grid is as tall as its icons. */
    rows?: number;
    disabled?: boolean;
    /* Clearing the icon. A surface that falls back to a default of its own offers that instead. */
    onClear?: () => void;
    /* The label above the grid. A surface that also takes an image calls this grid something else, or the two read as one list. */
    label?: string;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* A heading is stuck while its group runs past the top of the scroll area, and only then draws a line under it. */
const markStuckHeadings = (area: HTMLElement): void => {
    const top = area.scrollTop;
    for (const heading of area.querySelectorAll<HTMLElement>('[data-icon-heading]')) {
        const group = heading.parentElement;
        const stuck = group !== null && top > 0 && group.offsetTop <= top && group.offsetTop + group.offsetHeight > top;
        heading.toggleAttribute('data-stuck', stuck);
    }
};

/*
 * The mark a thing wears, one of a set of Lucide icons, as a grid under a label. With a search or a
 * height in rows, the search and the grid share one frame. The grid is one tab stop: arrows move the
 * focus and only Enter, Space or a click chooses, since a caller may save every choice at once.
 */
export function IconPicker({
    icons,
    value,
    onValueChange,
    keywords,
    searchable = isGrouped(icons),
    rows,
    disabled = false,
    onClear,
    label,
    className,
    ref
}: IconPickerProps) {
    const { t } = useTranslation('ui');
    const id = useId();
    const area = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState<string | null>(null);
    const headed = isGrouped(icons);
    const framed = searchable || rows !== undefined;
    const sections = useMemo(() => sectionsOf(icons), [icons]);
    const shown = useMemo(() => filterSections(sections, query, keywords), [sections, query, keywords]);
    const tabStop = tabStopOf(
        shown.flatMap((section) => section.icons.map(([name]) => name)),
        focused,
        value
    );
    const name = label ?? t('iconPicker.label');

    // Opens with the chosen icon in the middle of the area: a person changing an icon often starts from the current one.
    useLayoutEffect(() => {
        const element = area.current;
        const chosen = element?.querySelector<HTMLElement>('[aria-checked="true"]');
        if (!element || !chosen || element.scrollHeight <= element.clientHeight) {
            return;
        }
        const heading = element.querySelector<HTMLElement>('[data-icon-heading]')?.offsetHeight ?? 0;
        element.scrollTop = Math.round(chosen.offsetTop - heading - (element.clientHeight - heading - chosen.offsetHeight) / 2);
    }, []);

    const search = (next: string): void => {
        setQuery(next);
        if (area.current) {
            area.current.scrollTop = 0;
        }
    };

    const moveFocus = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }
        const cells = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
        const from = cells.indexOf(event.target as HTMLElement);
        if (from === -1) {
            return;
        }
        const to = cellForKey(
            event.key,
            cells.map((cell) => cell.getBoundingClientRect()),
            from
        );
        if (to === null) {
            return;
        }
        event.preventDefault();
        cells[to]?.focus();
    };

    const grid = (
        <div
            ref={area}
            id={`${id}-grid`}
            role="radiogroup"
            aria-label={name}
            className={clsx(framed && 'relative overflow-y-auto overscroll-contain', framed && (headed ? 'scroll-pt-7' : 'px-1.5 pt-1.5 pb-2'))}
            style={rows === undefined ? undefined : { height: rows * ROW_HEIGHT + (headed ? HEADED_EXTRA : BARE_EXTRA) }}
            onScroll={(event) => markStuckHeadings(event.currentTarget)}
            onKeyDown={moveFocus}
        >
            {shown.length === 0 && query.trim() !== '' ? (
                <EmptyState className="h-full">{t('iconPicker.noMatch', { query: query.trim() })}</EmptyState>
            ) : (
                shown.map((section, index) => {
                    const cells = (
                        <div
                            key={section.id}
                            className={clsx('grid grid-cols-[repeat(auto-fill,minmax(28px,1fr))] gap-1', framed && section.label !== null && 'px-1.5 pb-2')}
                        >
                            {section.icons.map(([icon, glyph]) => (
                                <Tooltip key={icon} label={icon} name>
                                    <button
                                        type="button"
                                        role="radio"
                                        aria-checked={value === icon}
                                        tabIndex={icon === tabStop ? 0 : -1}
                                        disabled={disabled}
                                        className={clsx(
                                            'flex h-7 items-center justify-center rounded-md hover:bg-surface-hover disabled:opacity-50',
                                            value === icon ? 'bg-surface-active text-text' : 'text-text-muted'
                                        )}
                                        onFocus={() => setFocused(icon)}
                                        onClick={() => onValueChange(icon)}
                                    >
                                        <Icon icon={glyph} size={16} />
                                    </button>
                                </Tooltip>
                            ))}
                        </div>
                    );
                    if (section.label === null) {
                        return cells;
                    }
                    const headingId = `${id}-group-${index}`;
                    return (
                        <div key={section.id} role="group" aria-labelledby={headingId}>
                            <SectionLabel
                                render={<div />}
                                data-icon-heading=""
                                className={clsx(
                                    'flex h-7 items-center gap-2',
                                    framed ? 'sticky top-0 z-10 bg-surface px-2.5 data-stuck:shadow-[0_1px_0_var(--border)]' : 'mt-1'
                                )}
                            >
                                <span id={headingId} className="truncate">
                                    {section.label}
                                </span>
                                <span className="ms-auto shrink-0">{formatNumber(section.icons.length)}</span>
                            </SectionLabel>
                            {cells}
                        </div>
                    );
                })
            )}
        </div>
    );

    return (
        <div ref={ref} className={className}>
            <SectionLabel render={<div />} className="mb-1.5 flex items-center gap-2">
                {name}
                {onClear && (
                    <>
                        <span className="grow" />
                        <IconButton
                            icon={Ban}
                            size="sm"
                            label={t('iconPicker.none')}
                            className="-my-1"
                            disabled={disabled || value === null}
                            onClick={onClear}
                        />
                    </>
                )}
            </SectionLabel>
            {framed ? (
                // The frame wears the field's outline while its search has the focus; the search draws none of its own.
                <div className="field h-auto overflow-hidden p-0 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-1 has-[input:focus-visible]:outline-accent">
                    {searchable && (
                        <div className="flex h-8 items-center gap-2 border-b border-border pr-1 pl-2.5">
                            <Icon icon={Search} size={14} className="shrink-0 text-text-faint" />
                            <input
                                ref={input}
                                type="text"
                                value={query}
                                placeholder={t('iconPicker.search')}
                                aria-label={t('iconPicker.search')}
                                aria-controls={`${id}-grid`}
                                spellCheck={false}
                                autoComplete="off"
                                disabled={disabled}
                                className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-faint"
                                onChange={(event) => search(event.target.value)}
                                onKeyDown={(event) => {
                                    if (escapeClearsSearch(event.key, query)) {
                                        event.stopPropagation();
                                        search('');
                                    }
                                }}
                            />
                            {query && (
                                <IconButton
                                    icon={X}
                                    size="sm"
                                    label={t('iconPicker.clear')}
                                    tooltip={false}
                                    onClick={() => {
                                        search('');
                                        input.current?.focus();
                                    }}
                                />
                            )}
                        </div>
                    )}
                    {grid}
                </div>
            ) : (
                grid
            )}
        </div>
    );
}
