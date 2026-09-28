import type { Ref } from 'react';
import clsx from 'clsx';

export interface MeterProps {
    /* In the unit of `min` and `max`, held to them. Null draws an empty track, for a level not measured yet. */
    value: number | null;
    min?: number;
    max?: number;
    /* Values drawn as lines across the track, such as a target or a limit. */
    marks?: readonly number[];
    label: string;
    /* The value in words for a screen reader, such as "-18.2 LUFS". Left out, it reads the number. */
    valueText?: string;
    /* Its width, which it fills. */
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* A level against a scale: how full it is, and where a target or a limit sits on the same scale. */
export function Meter({ value, min = 0, max = 100, marks = [], label, valueText, className, ref }: MeterProps) {
    const fractionOf = (level: number): number => (max > min ? Math.min(1, Math.max(0, (level - min) / (max - min))) : 0);

    return (
        <div
            ref={ref}
            role="meter"
            aria-label={label}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value === null ? min : Math.min(max, Math.max(min, value))}
            aria-valuetext={valueText}
            className={clsx('relative h-1.5 rounded-full bg-surface-sunken', className)}
        >
            {/* No transition on the width: a level that updates many times a second would lag and blur. */}
            {value !== null && <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${fractionOf(value) * 100}%` }} />}
            {marks.map((mark) => (
                <span key={mark} className="absolute -inset-y-0.5 w-px bg-text-muted" style={{ left: `${fractionOf(mark) * 100}%` }} />
            ))}
        </div>
    );
}
