import type { Ref } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { Icon } from './Icon.tsx';

export interface SegmentedOption<T extends string> {
    id: T;
    label: string;
    icon?: LucideIcon;
}

export interface SegmentedProps<T extends string> {
    value: T;
    onValueChange(id: T): void;
    options: readonly SegmentedOption<T>[];
    /* The accessible name of the group. */
    label: string;
    disabled?: boolean;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* One of a few options side by side in one sunken track, the picked one lifted out of it. */
export function Segmented<T extends string>({ value, onValueChange, options, label, disabled, className, ref }: SegmentedProps<T>) {
    return (
        <div
            ref={ref}
            className={clsx('flex h-8 w-fit items-center rounded-lg bg-surface-sunken p-0.5 text-xs font-medium', className)}
            role="radiogroup"
            aria-label={label}
        >
            {options.map((option) => (
                <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={value === option.id}
                    disabled={disabled}
                    className={clsx(
                        'flex h-7 items-center gap-1.5 rounded-md px-3 transition-colors disabled:opacity-50',
                        value === option.id ? 'bg-surface-raised text-text shadow-raised' : 'text-text-muted hover:text-text'
                    )}
                    onClick={() => onValueChange(option.id)}
                >
                    {option.icon && <Icon icon={option.icon} size={14} />}
                    {option.label}
                </button>
            ))}
        </div>
    );
}
