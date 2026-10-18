import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface SelectItem<T extends string> {
    value: T;
    label: string;
    /* A second line under the label, for what the choice does. */
    description?: string;
    icon?: ReactNode;
    disabled?: boolean;
}

export interface SelectGroup<T extends string> {
    label: string;
    items: SelectItem<T>[];
}

export const isGroup = <T extends string>(entry: SelectItem<T> | SelectGroup<T>): entry is SelectGroup<T> => Array.isArray((entry as SelectGroup<T>).items);

export const TRIGGER_SIZE = {
    sm: 'h-7 gap-1 px-2',
    md: 'h-8 gap-1.5 px-2'
} as const;

export const TRIGGER_VARIANT = {
    outlined: 'max-w-56 rounded-lg border border-border bg-surface-raised text-text',
    ghost: 'rounded-md text-text-muted hover:bg-surface-hover hover:text-text data-[popup-open]:bg-surface-active data-[popup-open]:text-text data-disabled:hover:bg-transparent data-disabled:hover:text-text-muted'
} as const;

/* The dimmed look `Switch` and `Button` wear when disabled, so a select that cannot open reads as such. */
export const TRIGGER_DISABLED = 'data-disabled:cursor-default data-disabled:opacity-50';

/* The trigger of every select, and of any other picker that stands in a row of selects and has to line up with them. */
export const triggerClassName = (size: keyof typeof TRIGGER_SIZE, variant: keyof typeof TRIGGER_VARIANT, className?: string): string =>
    clsx('flex shrink-0 items-center whitespace-nowrap text-xs', TRIGGER_SIZE[size], TRIGGER_VARIANT[variant], TRIGGER_DISABLED, className);

/* A description makes the row two lines high; the box keeps the icon on the label's line. */
export const rowClassName = (item: SelectItem<string>): string => clsx('menu-item', item.description && 'items-start');
