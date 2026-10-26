import { Fragment, useId, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Icon } from './Icon.tsx';

export interface Choice<Value extends string | number> {
    value: Value;
    title: string;
    description: string;
    icon?: LucideIcon;
    disabled?: boolean;
}

export interface ChoiceCardsProps<Value extends string | number> {
    value: Value;
    onValueChange(value: Value): void;
    choices: readonly Choice<Value>[];
    /* Read by a screen reader, since the row has no visible heading of its own. */
    label: string;
    orientation?: 'horizontal' | 'vertical';
    /* Filled row by row; takes the place of `orientation`. */
    columns?: number;
    radio?: 'start' | 'end';
    /* What the checked choice still asks for, under its card; only a vertical group without columns has room for it. */
    detail?: ReactNode;
    disabled?: boolean;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

function ChoiceCard<Value extends string | number>({ choice, radio }: { choice: Choice<Value>; radio: 'start' | 'end' }) {
    const id = useId();
    // As tall as the title's line, so the dot centers on it.
    const dot = (
        <span className="flex h-(--text-sm--line-height) shrink-0 items-center" aria-hidden>
            <span className="size-4 rounded-full border border-border-strong group-data-checked:border-5 group-data-checked:border-accent group-data-checked:bg-accent-text" />
        </span>
    );
    return (
        <Radio.Root
            value={choice.value}
            disabled={choice.disabled}
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-description`}
            className="group focus-ring flex min-w-0 items-start gap-3 rounded-xl border border-border bg-surface p-3 text-left hover:bg-surface-hover-edged data-checked:border-accent data-disabled:opacity-50 data-disabled:hover:bg-surface"
        >
            {radio === 'start' && dot}
            {choice.icon && (
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-sunken text-text-muted group-data-checked:text-accent dark:bg-field dark:inset-ring dark:inset-ring-field-border">
                    <Icon icon={choice.icon} size={16} />
                </span>
            )}
            <span className="flex min-w-0 grow flex-col gap-0.5">
                <span id={`${id}-title`} className="text-sm font-medium text-text">
                    {choice.title}
                </span>
                <span id={`${id}-description`} className="text-xs text-pretty text-text-muted">
                    {choice.description}
                </span>
            </span>
            {radio === 'end' && dot}
        </Radio.Root>
    );
}

export function ChoiceCards<Value extends string | number>({
    value,
    onValueChange,
    choices,
    label,
    orientation = 'horizontal',
    columns,
    radio = 'end',
    detail,
    disabled,
    className,
    ref
}: ChoiceCardsProps<Value>) {
    const vertical = columns === undefined && orientation === 'vertical';
    return (
        <RadioGroup
            ref={ref}
            value={value}
            onValueChange={(next) => onValueChange(next as Value)}
            disabled={disabled}
            aria-label={label}
            className={clsx('grid gap-2', columns !== undefined || vertical ? 'grid-flow-row' : 'auto-cols-fr grid-flow-col', className)}
            style={columns !== undefined ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
        >
            {choices.map((choice) => (
                <Fragment key={choice.value}>
                    <ChoiceCard choice={choice} radio={radio} />
                    {vertical && choice.value === value && detail}
                </Fragment>
            ))}
        </RadioGroup>
    );
}
