import { useId, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowDownWideNarrow, ArrowRightToLine, ArrowUp, Code, Filter, Search, X, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Icon, IconButton, Kbd, KEY_SHORTCUTS, Keys, Menu, shortcut } from '@adecore/ui';
import type { Engine } from '../protocol/index.ts';
import {
    addChip,
    filterStartText,
    removeChipAt,
    replaceChipAt,
    suggest,
    toggleSort,
    type Chip,
    type CommandColumn,
    type FilterChip,
    type Suggestion
} from './command-field.ts';

const FOCUS_SHORTCUT = shortcut('Mod+F');

export interface CommandFieldProps {
    chips: readonly Chip[];
    columns: readonly CommandColumn[];
    engine: Engine;
    /* Every change of the chips applies at once, so this is told the whole list each time. */
    onChipsChange(next: Chip[]): void;
    onJumpToColumn(name: string): void;
    /* The text input, for the owner to focus on Mod+F. */
    inputRef?: Ref<HTMLInputElement>;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

const SUGGESTION_ICON: Record<Suggestion['kind'], LucideIcon> = {
    condition: Filter,
    filter: Filter,
    sort: ArrowDownWideNarrow,
    jump: ArrowRightToLine,
    sql: Code
};

const columnOf = (suggestion: Suggestion): CommandColumn | null => (suggestion.kind === 'sql' || suggestion.kind === 'condition' ? null : suggestion.column);

/*
 * One field for the conditions and the sorts of a table. They are chips in front of the text; typing
 * opens suggestions to filter on a column, sort by it or jump to it, and a text that reads as a
 * condition (`quantity > 1`) becomes a chip on Enter.
 */
export function CommandField({ chips, columns, engine, onChipsChange, onJumpToColumn, inputRef, className, ref }: CommandFieldProps) {
    const { t } = useTranslation('database');
    const listId = useId();
    const input = useRef<HTMLInputElement>(null);
    const [text, setText] = useState('');
    /* The chip whose text is in the input to be changed; it stays in the list, hidden, until the change is made. */
    const [editing, setEditing] = useState<number | null>(null);
    const [focused, setFocused] = useState(false);
    const [active, setActive] = useState(0);
    const [dismissed, setDismissed] = useState(false);
    const suggestions = useMemo(() => suggest(engine, text, columns), [engine, text, columns]);
    const open = focused && !dismissed && suggestions.length > 0;
    const optionId = (index: number): string => `${listId}-${index}`;

    useImperativeHandle(inputRef, () => input.current!, []);

    const change = (value: string): void => {
        setText(value);
        setActive(0);
        setDismissed(false);
    };

    const clear = (): void => {
        setText('');
        setEditing(null);
        setActive(0);
        setDismissed(false);
    };

    const commit = (chip: FilterChip): void => {
        onChipsChange(editing === null ? addChip(chips, chip) : replaceChipAt(chips, editing, chip));
        clear();
    };

    const pick = (suggestion: Suggestion): void => {
        switch (suggestion.kind) {
            case 'condition':
            case 'sql':
                commit(suggestion.chip);
                break;
            case 'filter':
                change(filterStartText(suggestion.column));
                input.current?.focus();
                break;
            case 'sort':
                onChipsChange(toggleSort(chips, suggestion.column.name));
                clear();
                break;
            case 'jump':
                clear();
                onJumpToColumn(suggestion.column.name);
                break;
        }
    };

    const edit = (index: number, chip: FilterChip): void => {
        setEditing(index);
        setText(chip.text);
        setActive(0);
        setDismissed(true);
        input.current?.focus();
    };

    const activate = (index: number, chip: Chip): void => {
        if (chip.kind === 'filter') {
            edit(index, chip);
        } else if (chip.kind === 'sort') {
            onChipsChange(toggleSort(chips, chip.column));
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.nativeEvent.isComposing) {
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (suggestions.length > 0) {
                event.preventDefault();
                setDismissed(false);
                setActive((now) => (now + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
            }
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const suggestion = suggestions[Math.min(active, suggestions.length - 1)];
            if (suggestion !== undefined) {
                pick(suggestion);
            } else if (editing !== null) {
                onChipsChange(removeChipAt(chips, editing));
                clear();
            }
        } else if (event.key === 'Escape') {
            if (open) {
                event.preventDefault();
                setDismissed(true);
            } else if (text !== '' || editing !== null) {
                event.preventDefault();
                clear();
            }
        } else if (event.key === 'Backspace' && text === '' && editing === null && chips.length > 0) {
            event.preventDefault();
            onChipsChange(removeChipAt(chips, chips.length - 1));
        }
    };

    const handleBlur = (): void => {
        setFocused(false);
        if (editing !== null) {
            clear();
        }
    };

    return (
        <div
            ref={ref}
            className={clsx('field field-sm focus-ring-within relative flex h-auto min-h-7 min-w-0 flex-1 flex-wrap items-center gap-1 py-0.5', className)}
            onClick={(event) => event.target === event.currentTarget && input.current?.focus()}
        >
            <Icon icon={Search} size={14} className="shrink-0 text-text-faint" />
            {chips.map((chip, index) =>
                index === editing ? null : (
                    <ChipView
                        key={`${chip.kind}:${chip.kind === 'sort' ? chip.column : chip.text}`}
                        chip={chip}
                        onActivate={() => activate(index, chip)}
                        onRemove={() => onChipsChange(removeChipAt(chips, index))}
                    />
                )
            )}
            <input
                ref={input}
                role="combobox"
                aria-label={t('table.command.label')}
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
                aria-activedescendant={open ? optionId(active) : undefined}
                aria-autocomplete="list"
                value={text}
                placeholder={chips.length === 0 ? t('table.command.placeholder') : undefined}
                spellCheck={false}
                autoComplete="off"
                className="min-w-24 flex-1 bg-transparent font-mono text-code text-text outline-none placeholder:font-sans placeholder:text-text-faint"
                onChange={(event) => change(event.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={handleBlur}
            />
            <Keys shortcut={FOCUS_SHORTCUT} size="sm" className="shrink-0" />
            {open && (
                <div
                    id={listId}
                    role="listbox"
                    aria-label={t('table.command.suggestions')}
                    className="menu-popup absolute top-full left-0 z-(--z-popup) mt-1.5 max-h-80 w-full max-w-xl"
                    // The input keeps the focus, or the popup would close under the pointer.
                    onPointerDown={(event) => event.preventDefault()}
                >
                    {suggestions.map((suggestion, index) => {
                        const column = columnOf(suggestion);
                        const previous = suggestions[index - 1];
                        const startsGroup = column !== null && (previous === undefined || columnOf(previous)?.name !== column.name);
                        return (
                            <div key={`${suggestion.kind}:${column?.name ?? ''}`} role="presentation">
                                {startsGroup && (
                                    <Menu.Label>
                                        <span className="font-mono">{column.name}</span>
                                        {column.type !== '' && <span> · {column.type}</span>}
                                    </Menu.Label>
                                )}
                                {suggestion.kind === 'sql' && index > 0 && <Menu.Separator />}
                                <div
                                    id={optionId(index)}
                                    role="option"
                                    aria-selected={index === active}
                                    data-active={index === active}
                                    className="menu-item cursor-row"
                                    onPointerMove={() => setActive(index)}
                                    onClick={() => pick(suggestion)}
                                >
                                    <Icon icon={SUGGESTION_ICON[suggestion.kind]} size={14} />
                                    <SuggestionLabel suggestion={suggestion} />
                                    {index === active && suggestion.kind !== 'sql' && <Kbd shortcut={KEY_SHORTCUTS.enter} />}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function SuggestionLabel({ suggestion }: { suggestion: Suggestion }) {
    const { t } = useTranslation('database');
    switch (suggestion.kind) {
        case 'condition':
            return (
                <>
                    {t('table.command.addFilter')} <span className="min-w-0 truncate font-mono">{suggestion.chip.text}</span>
                </>
            );
        case 'filter':
            return (
                <>
                    {t('table.command.filterOn')} <span className="font-mono">{suggestion.column.name}</span>
                </>
            );
        case 'sort':
            return (
                <>
                    {t('table.command.sortBy')} <span className="font-mono">{suggestion.column.name}</span>
                </>
            );
        case 'jump':
            return t('table.command.jumpTo');
        case 'sql':
            return (
                <>
                    {t('table.command.asSql')}
                    <Menu.Hint className="font-mono">WHERE …</Menu.Hint>
                </>
            );
    }
}

interface ChipViewProps {
    chip: Chip;
    onActivate(): void;
    onRemove(): void;
}

/* A filter opens its text for editing, a sort flips its direction, and a raw ORDER BY is only shown. */
function ChipView({ chip, onActivate, onRemove }: ChipViewProps) {
    const { t } = useTranslation('database');
    return (
        <span className="inline-flex h-5 max-w-72 min-w-0 shrink-0 items-center rounded-md bg-text/10 font-mono text-code text-text">
            {chip.kind === 'filter' && (
                <button
                    type="button"
                    aria-label={t('table.command.editFilter', { filter: chip.text })}
                    className="min-w-0 truncate pl-1.5 text-left"
                    onClick={onActivate}
                >
                    {chip.text}
                </button>
            )}
            {chip.kind === 'sort' && (
                <button
                    type="button"
                    aria-label={t('table.command.flipSort', { column: chip.column })}
                    className="inline-flex min-w-0 items-center gap-1 pl-1.5 text-left"
                    onClick={onActivate}
                >
                    <Icon icon={chip.direction === 'asc' ? ArrowUp : ArrowDown} size={12} className="shrink-0" />
                    <span className="truncate">{chip.column}</span>
                </button>
            )}
            {chip.kind === 'order' && <span className="min-w-0 truncate pl-1.5">{chip.text}</span>}
            <IconButton
                icon={X}
                size="2xs"
                label={t(chip.kind === 'sort' ? 'table.command.removeSort' : 'table.command.removeFilter')}
                tooltip={false}
                className="shrink-0"
                onClick={onRemove}
            />
        </span>
    );
}
