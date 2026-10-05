import type { Ref } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Button } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';

export interface NamePickerProps {
    /* Every name that can be picked, in the order to show them. */
    options: readonly string[];
    /* The names picked, in the order they were picked: for a key that order is the order of its columns. */
    value: readonly string[];
    onToggle(name: string): void;
    /* The accessible name of the group. */
    label: string;
    disabled?: boolean;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* Picks some of a few names, such as the columns of an index, and numbers the picks once there is more than one. */
export function NamePicker({ options, value, onToggle, label, disabled = false, className, ref }: NamePickerProps) {
    const { t } = useTranslation('database');
    return (
        <div ref={ref} role="group" aria-label={label} className={clsx('flex flex-wrap items-center gap-1', className)}>
            {options.length === 0 && <span className="text-xs text-text-faint">{t('designer.noColumnsToPick')}</span>}
            {options.map((name) => {
                const position = value.indexOf(name);
                return (
                    <Button
                        key={name}
                        size="xs"
                        variant={position < 0 ? 'ghost' : 'secondary'}
                        aria-pressed={position >= 0}
                        disabled={disabled}
                        onClick={() => onToggle(name)}
                    >
                        {position >= 0 && value.length > 1 && <span className="text-text-faint">{formatNumber(position + 1)}</span>}
                        {name}
                    </Button>
                );
            })}
        </div>
    );
}
