import type { KeyboardEvent, Ref } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { Icon } from './Icon.tsx';
import { segmentedStop, segmentedTarget } from './segmented-keys.ts';
import { Tooltip } from './Tooltip.tsx';

export interface SegmentedOption<T extends string> {
    id: T;
    label: string;
    icon?: LucideIcon;
    /* Takes the option out of the tab order and the arrow keys; the rest of the group stays usable. */
    disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
    value: T;
    onValueChange(id: T): void;
    options: readonly SegmentedOption<T>[];
    label: string;
    disabled?: boolean;
    /* `vertical` is as wide as its container, for labels too long to stand side by side. */
    orientation?: 'horizontal' | 'vertical';
    /* The heights of `Input`, `Select` and `Button`. */
    size?: 'md' | 'sm';
    /* An option with an icon draws as a square, its label as its accessible name and tooltip. One without an icon keeps its label. */
    iconOnly?: boolean;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

const SIZE = {
    md: { track: 'rounded-lg', row: 'min-h-8', option: 'min-h-7 rounded-md px-3 py-1', square: 'size-7 rounded-md', icon: 14 },
    sm: { track: 'rounded-md', row: 'min-h-7', option: 'min-h-6 rounded-sm px-2.5 py-0.5', square: 'size-6 rounded-sm', icon: 12 }
} as const;

/* A radio group: one tab stop, and the arrows pick and focus the next option, around the ends. */
export function Segmented<T extends string>({
    value,
    onValueChange,
    options,
    label,
    disabled,
    orientation = 'horizontal',
    size = 'md',
    iconOnly = false,
    className,
    ref
}: SegmentedProps<T>) {
    const vertical = orientation === 'vertical';
    const sizing = SIZE[size];
    const stop = segmentedStop(options, value);

    const move = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
        const next = segmentedTarget(options, index, event.key);
        if (next === null) {
            return;
        }
        event.preventDefault();
        onValueChange(options[next]!.id);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
    };

    return (
        <div
            ref={ref}
            className={clsx(
                'flex bg-surface-sunken p-0.5 text-xs font-medium dark:bg-surface-idle',
                sizing.track,
                vertical ? 'w-full flex-col items-stretch gap-0.5' : clsx(sizing.row, 'w-fit items-center'),
                className
            )}
            role="radiogroup"
            aria-label={label}
            aria-orientation={vertical ? 'vertical' : undefined}
        >
            {options.map((option, index) => {
                const square = iconOnly && option.icon !== undefined;
                const button = (
                    <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={value === option.id}
                        tabIndex={index === stop ? 0 : -1}
                        disabled={disabled || option.disabled}
                        className={clsx(
                            'flex items-center transition-colors disabled:opacity-50',
                            square ? clsx(sizing.square, 'justify-center') : clsx(sizing.option, 'gap-1.5 text-left'),
                            value === option.id ? 'bg-surface-raised text-text shadow-raised' : 'text-text-muted enabled:hover:text-text'
                        )}
                        onClick={() => onValueChange(option.id)}
                        onKeyDown={(event) => move(event, index)}
                    >
                        {option.icon && <Icon icon={option.icon} size={sizing.icon} className="shrink-0" />}
                        {!square && option.label}
                    </button>
                );
                return square ? (
                    <Tooltip key={option.id} label={option.label} name>
                        {button}
                    </Tooltip>
                ) : (
                    button
                );
            })}
        </div>
    );
}
