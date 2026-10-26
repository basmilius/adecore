import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import clsx from 'clsx';
import { Ban, ChevronDown, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button.tsx';
import { EmptyState } from './EmptyState.tsx';
import { formatNumber } from './format/number.ts';
import { Icon } from './Icon.tsx';
import { IconButton } from './IconButton.tsx';
import { cellForKey, escapeClearsSearch, filterSections, isGrouped, sectionsOf, tabStopOf, type IconPickerIcons, type IconSection } from './icon-picker.ts';
import { PopoverPopup, PopoverRoot, PopoverTrigger } from './popover/parts.tsx';
import { SectionLabel } from './SectionLabel.tsx';
import { Tooltip } from './Tooltip.tsx';

export type { IconPickerGroup } from './icon-picker.ts';

/* A row of cells is 28 high with a gap of 4. Under a heading of 28 the last row keeps 8 below it; without headings the grid has 6 above as well. */
const ROW_HEIGHT = 32;

const HEADED_EXTRA = 32;
const BARE_EXTRA = 10;

export interface IconPickerProps {
    /* By name, in the order of the grid, or in groups under a heading each. The name is also its tooltip. */
    icons: IconPickerIcons;

    value: string | null;
    onValueChange(name: string): void;

    /* By icon name: more words a search finds it by, beside its name and its group's label. */
    keywords?: Readonly<Record<string, readonly string[]>>;

    /* On by default for groups, off for a flat set. */
    searchable?: boolean;

    /* The grid as a scroll area this many rows high. Without it the grid is as tall as its icons. */
    rows?: number;

    disabled?: boolean;
    onClear?: () => void;
    label?: string;

    /* It still names the trigger. */
    hideLabel?: boolean;

    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* Only a stuck heading draws a line under it. */
const markStuckHeadings = (area: HTMLElement): void => {
    const top = area.scrollTop;

    for (const heading of area.querySelectorAll<HTMLElement>('[data-icon-heading]')) {
        const group = heading.parentElement;
        const stuck = group !== null && top > 0 && group.offsetTop <= top && group.offsetTop + group.offsetHeight > top;
        heading.toggleAttribute('data-stuck', stuck);
    }
};

/* The grid is one tab stop: arrows move the focus and only Enter, Space or a click chooses, since a caller may save every choice at once. */
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
    hideLabel = false,
    className,
    ref
}: IconPickerProps) {
    const { t } = useTranslation('ui');
    const id = useId();
    const trigger = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const sections = sectionsOf(icons);
    const glyph = value === null ? undefined : sections.flatMap((section) => section.icons).find(([icon]) => icon === value)?.[1];
    const name = label ?? t('iconPicker.label');
    const clearable = onClear !== undefined && value !== null && !disabled;

    const choose = (icon: string): void => {
        onValueChange(icon);
        setOpen(false);
    };

    const clear = (): void => {
        onClear?.();
        setOpen(false);
    };

    return (
        <div ref={ref} className={clsx('flex flex-col gap-1.5', className)}>
            <SectionLabel id={`${id}-label`} render={<div />} className={clsx(hideLabel && 'sr-only')}>
                {name}
            </SectionLabel>
            <PopoverRoot open={open} onOpenChange={setOpen}>
                <div className="flex gap-1.5">
                    <PopoverTrigger
                        ref={trigger}
                        disabled={disabled}
                        aria-labelledby={`${id}-label ${id}-value`}
                        className="field flex w-auto min-w-0 items-center gap-2 text-left hover:bg-surface-hover data-disabled:cursor-default data-disabled:opacity-50 data-disabled:hover:bg-field data-[popup-open]:bg-surface-hover"
                    >
                        {glyph && <Icon icon={glyph} size={16} className="shrink-0 text-text" />}
                        {/* The icon says which it is; its name is there for a screen reader. */}
                        <span id={`${id}-value`} className={clsx('min-w-0 truncate', glyph ? 'sr-only' : 'text-text-faint')}>
                            {value ?? t('iconPicker.placeholder')}
                        </span>
                        <Icon icon={ChevronDown} size={14} className="shrink-0 text-text-faint" />
                    </PopoverTrigger>
                    {clearable && (
                        <Tooltip label={t('iconPicker.none')}>
                            <Button
                                variant="secondary"
                                className="w-8 shrink-0 px-0!"
                                aria-label={t('iconPicker.none')}
                                onClick={() => {
                                    onClear();
                                    trigger.current?.focus();
                                }}
                            >
                                <Icon icon={X} size={16} />
                            </Button>
                        </Tooltip>
                    )}
                </div>
                <PopoverPopup
                    variant="picker"
                    aria-label={name}
                    className="w-90"
                    initialFocus={() =>
                        document.getElementById(`${id}-search`) ?? document.getElementById(`${id}-grid`)?.querySelector<HTMLElement>('[tabindex="0"]') ?? false
                    }
                    finalFocus={trigger}
                >
                    <IconPickerPanel
                        id={id}
                        name={name}
                        sections={sections}
                        headed={isGrouped(icons)}
                        value={value}
                        keywords={keywords}
                        searchable={searchable}
                        rows={rows}
                        disabled={disabled}
                        onChoose={choose}
                        onClear={onClear && clear}
                    />
                </PopoverPopup>
            </PopoverRoot>
        </div>
    );
}

interface IconPickerPanelProps {
    id: string;
    name: string;
    sections: readonly IconSection[];
    headed: boolean;
    value: string | null;
    keywords: Readonly<Record<string, readonly string[]>> | undefined;
    searchable: boolean;
    rows: number | undefined;
    disabled: boolean;
    onChoose(name: string): void;
    onClear: (() => void) | undefined;
}

/* It mounts on every open, so a search and the focus start over each time. */
function IconPickerPanel({ id, name, sections, headed, value, keywords, searchable, rows, disabled, onChoose, onClear }: IconPickerPanelProps) {
    const { t } = useTranslation('ui');
    const input = useRef<HTMLInputElement>(null);
    const area = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState<string | null>(null);
    const shown = filterSections(sections, query, keywords);

    const tabStop = tabStopOf(
        shown.flatMap((section) => section.icons.map(([icon]) => icon)),
        focused,
        value
    );

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

    // Escape empties a search first, wherever the focus is, and only an empty one reaches the popover and closes it.
    const clearSearchFirst = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (!escapeClearsSearch(event.key, query)) {
            return;
        }

        event.stopPropagation();
        event.preventDefault();
        search('');
        input.current?.focus();
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

    return (
        <div onKeyDown={clearSearchFirst}>
            {searchable && (
                <div className="flex h-9 items-center gap-2 border-b border-border pr-1 pl-2.5">
                    <Icon icon={Search} size={14} className="shrink-0 text-text-faint" />
                    <input
                        ref={input}
                        id={`${id}-search`}
                        type="text"
                        value={query}
                        placeholder={t('iconPicker.search')}
                        aria-label={t('iconPicker.search')}
                        aria-controls={`${id}-grid`}
                        spellCheck={false}
                        autoComplete="off"
                        disabled={disabled}
                        className="h-full min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-faint"
                        onChange={(event) => search(event.target.value)}
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
            <div
                ref={area}
                id={`${id}-grid`}
                role="radiogroup"
                aria-label={name}
                className={clsx('relative overflow-y-auto overscroll-contain', headed ? 'scroll-pt-7' : 'px-1.5 pt-1.5 pb-2')}
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
                                className={clsx('grid grid-cols-[repeat(auto-fill,minmax(28px,1fr))] gap-1', section.label !== null && 'px-1.5 pb-2')}
                            >
                                {section.icons.map(([icon, cellGlyph]) => (
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
                                            onClick={() => onChoose(icon)}
                                        >
                                            <Icon icon={cellGlyph} size={16} />
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
                                {/* A step lighter than the popover in the dark theme, where a darker band would read as a hole in it. */}
                                <SectionLabel
                                    render={<div />}
                                    data-icon-heading=""
                                    className="sticky top-0 z-10 flex h-7 items-center gap-2 bg-surface px-2.5 data-stuck:shadow-[0_1px_0_var(--border)] dark:bg-surface-hover"
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
            {onClear && (
                <div className="flex border-t border-border p-1">
                    <Button size="sm" disabled={disabled || value === null} onClick={onClear}>
                        <Icon icon={Ban} size={12} />
                        {t('iconPicker.none')}
                    </Button>
                </div>
            )}
        </div>
    );
}
