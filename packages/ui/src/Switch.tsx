import type { Ref } from 'react';
import clsx from 'clsx';
import { Switch as BaseSwitch } from '@base-ui/react/switch';

export interface SwitchProps {
    checked: boolean;
    onCheckedChange(checked: boolean): void;

    /* The accessible name; the row it sits in usually carries the visible one. */
    label: string;

    disabled?: boolean;
    className?: string;
    ref?: Ref<HTMLButtonElement>;
}

/* On or off, as a switch rather than a checkbox: a setting that takes effect the moment it flips. */
export function Switch({ checked, onCheckedChange, label, disabled, className, ref }: SwitchProps) {
    return (
        <BaseSwitch.Root
            ref={ref}
            checked={checked}
            onCheckedChange={(next) => onCheckedChange(next)}
            aria-label={label}
            disabled={disabled}
            // Base UI renders the root as a `span`, which ignores its size outside a flex row unless it lays out as a box.
            className={clsx(
                'relative inline-flex h-5 w-9 shrink-0 rounded-full bg-border-strong p-0.5 transition-colors data-checked:bg-accent dark:not-data-checked:bg-field dark:not-data-checked:inset-ring dark:not-data-checked:inset-ring-field-border data-disabled:opacity-50',
                className
            )}
        >
            <BaseSwitch.Thumb className="block h-4 w-4 rounded-full bg-thumb shadow-thumb transition-transform data-checked:translate-x-4" />
        </BaseSwitch.Root>
    );
}
