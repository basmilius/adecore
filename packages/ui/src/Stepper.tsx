import type { Ref } from 'react';
import clsx from 'clsx';
import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ButtonGroup } from './ButtonGroup.tsx';
import { formatFixed } from './format/number.ts';
import { IconButton } from './IconButton.tsx';
import { placesOf } from './step-places.ts';

export interface StepperProps {
    value: number;
    onValueChange(value: number): void;
    min: number;
    max: number;
    step: number;
    /* Places after the separator, always shown: `1,0`, `1,5`. Defaults to the places `step` is written with. */
    decimals?: number;
    /* Printed right after the number, such as `px` or `%`. */
    unit?: string;
    label: string;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* A number between minus and plus, in one sunken group so the three read as a single control. */
export function Stepper({ value, onValueChange, min, max, step, decimals = placesOf(step), unit, label, className, ref }: StepperProps) {
    const { t } = useTranslation('ui');
    const reading = (amount: number) => (
        <>
            {formatFixed(amount, decimals)}
            {unit && <span className="text-text-muted">{unit}</span>}
        </>
    );
    const nudge = (direction: -1 | 1): void => {
        const next = Math.round((value + direction * step) * 100) / 100;
        onValueChange(Math.min(max, Math.max(min, next)));
    };
    return (
        <ButtonGroup ref={ref} className={clsx('shrink-0 rounded-lg bg-surface-sunken p-0.5', className)} role="group" aria-label={label}>
            <IconButton
                icon={Minus}
                size="sm"
                label={t('controls.stepper.smallerFor', { label })}
                tooltip={t('controls.stepper.smaller')}
                disabled={value <= min}
                onClick={() => nudge(-1)}
            />
            {/* The ends sit invisible in the same cell, so the widest of them sets the width and a step never moves the buttons. */}
            <span className="grid min-w-10 px-1 text-center text-xs text-text tabular-nums">
                <span className="invisible col-start-1 row-start-1">{reading(min)}</span>
                <span className="invisible col-start-1 row-start-1">{reading(max)}</span>
                <span className="col-start-1 row-start-1" aria-live="polite">
                    {reading(value)}
                </span>
            </span>
            <IconButton
                icon={Plus}
                size="sm"
                label={t('controls.stepper.largerFor', { label })}
                tooltip={t('controls.stepper.larger')}
                disabled={value >= max}
                onClick={() => nudge(1)}
            />
        </ButtonGroup>
    );
}
