import type { Ref } from 'react';
import clsx from 'clsx';
import { Ban, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon.tsx';
import { IconButton } from './IconButton.tsx';
import { SectionLabel } from './SectionLabel.tsx';
import { Tooltip } from './Tooltip.tsx';

export interface IconPickerProps {
    /* Every icon on offer by its name, in the order of the grid. The name is also its tooltip. */
    icons: Readonly<Record<string, LucideIcon>>;
    /* The name of the icon as it stands, or null for none. */
    value: string | null;
    onValueChange(name: string): void;
    disabled?: boolean;
    /* Clearing the icon. A surface that falls back to a default of its own offers that instead. */
    onClear?: () => void;
    /* The label above the grid. A surface that also takes an image calls this grid something else, or the two read as one list. */
    label?: string;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* The mark a thing wears, one of a set of Lucide icons, as a grid under a label. */
export function IconPicker({ icons, value, onValueChange, disabled = false, onClear, label, className, ref }: IconPickerProps) {
    const { t } = useTranslation('ui');
    return (
        <div ref={ref} className={className}>
            <SectionLabel render={<div />} className="mb-1.5 flex items-center gap-2">
                {label ?? t('iconPicker.label')}
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
            <div className="grid grid-cols-[repeat(auto-fill,minmax(28px,1fr))] gap-1">
                {Object.entries(icons).map(([name, glyph]) => (
                    <Tooltip key={name} label={name} name>
                        <button
                            type="button"
                            role="radio"
                            aria-checked={value === name}
                            disabled={disabled}
                            className={clsx(
                                'flex h-7 items-center justify-center rounded-md hover:bg-surface-hover disabled:opacity-50',
                                value === name ? 'bg-surface-active text-text' : 'text-text-muted'
                            )}
                            onClick={() => onValueChange(name)}
                        >
                            <Icon icon={glyph} size={16} />
                        </button>
                    </Tooltip>
                ))}
            </div>
        </div>
    );
}
