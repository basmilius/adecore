import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import clsx from 'clsx';
import { mergeRefs } from './merge-refs.ts';
import { Tooltip } from './Tooltip.tsx';
import { useMeasuredWidth } from './useMeasuredWidth.ts';

export interface SegmentBarPart {
    /* Its length, in the unit of the bar's `range`. Parts follow each other from 0. */
    value: number;
    /* Drawn in the part where there is room for it, and always read by a screen reader. */
    label?: string;
    /* Any CSS color, such as `var(--positive)`, in place of the theme's. It wins over the accent of `current`. */
    color?: string;
    /* The part a person is at, such as the section under the playhead. */
    current?: boolean;
}

export interface SegmentBarProps {
    parts: readonly SegmentBarPart[];
    /* The stretch the bar shows, in the unit of the parts: the rest of a whole, or the visible part of a zoomed timeline.
       Defaults to 0 up to the end of the last part. */
    range?: readonly [from: number, to: number];
    /* `md` draws each label in its part, `sm` is a thin bar that shows its labels only as a tooltip. */
    size?: 'sm' | 'md';
    /* Makes every part a button, which calls this with its index in `parts`. */
    onSelect?(index: number): void;
    /* The accessible name of the whole. */
    label?: string;
    className?: string;
    ref?: Ref<HTMLOListElement>;
}

/* A whole split into parts, each as wide as it lasts, so they compare at a glance. A part starts exactly at its
   place; the gap between two parts comes out of the one before. */
export function SegmentBar({ parts, range, size = 'md', onSelect, label, className, ref }: SegmentBarProps) {
    const [measure, width] = useMeasuredWidth();
    const rootRef = useMemo(() => mergeRefs(ref, measure), [ref, measure]);
    const labels = useRef<(HTMLSpanElement | null)[]>([]);
    const [cut, setCut] = useState<readonly boolean[]>([]);

    let start = 0;
    const placed = parts.map((part, index) => {
        const from = start;
        start += Math.max(0, part.value);
        return { part, index, from, to: start };
    });
    const [from, to] = range ?? [0, start];
    const span = to - from;
    const visible = span > 0 ? placed.filter((placement) => placement.to > from && placement.from < to) : [];
    // Parts without a name say nothing a screen reader could use; the element around the bar names it, as a meter does.
    // Parts a person can press stay reachable, since a hidden list must not hold focusable buttons.
    const hidden = onSelect === undefined && !parts.some((part) => part.label !== undefined);

    // A label that stops fitting after a resize or a new range gets its tooltip.
    useEffect(() => {
        const next = labels.current.slice(0, visible.length).map((element) => element !== null && element.scrollWidth > element.clientWidth);
        setCut((current) => (current.length === next.length && current.every((value, i) => value === next[i]) ? current : next));
    }, [width, parts, from, to, size, visible.length]);

    return (
        <ol
            ref={rootRef}
            aria-label={hidden ? undefined : label}
            aria-hidden={hidden ? true : undefined}
            className={clsx('relative min-w-0', size === 'sm' ? 'h-1.5' : 'h-7', className)}
        >
            {visible.map(({ part, index, from: partFrom, to: partTo }, i) => {
                const left = (Math.max(partFrom, from) - from) / span;
                const right = (Math.min(partTo, to) - from) / span;
                const fill = clsx(
                    'flex size-full min-w-0 items-center',
                    size === 'sm' ? 'rounded-full' : 'rounded-sm px-1.5 text-left text-xs',
                    part.current && (size === 'sm' ? 'bg-accent' : 'bg-accent-soft text-text'),
                    !part.current && part.color === undefined && 'bg-surface-active',
                    !part.current && size === 'md' && 'text-text-muted',
                    onSelect !== undefined && 'cursor-pointer hover:opacity-80'
                );
                const text = (
                    <span
                        ref={(element) => {
                            labels.current[i] = element;
                        }}
                        className={size === 'sm' ? 'sr-only' : 'min-w-0 truncate'}
                    >
                        {part.label}
                    </span>
                );
                const body =
                    onSelect === undefined ? (
                        <span className={fill} style={{ backgroundColor: part.color }} aria-current={part.current ? true : undefined}>
                            {text}
                        </span>
                    ) : (
                        <button
                            type="button"
                            className={fill}
                            style={{ backgroundColor: part.color }}
                            aria-current={part.current ? true : undefined}
                            onClick={() => onSelect(index)}
                        >
                            {text}
                        </button>
                    );
                return (
                    <li
                        key={index}
                        className={clsx('absolute inset-y-0 focus-within:z-10', i < visible.length - 1 && 'pr-0.5')}
                        style={{ left: `${left * 100}%`, width: `${(right - left) * 100}%` }}
                    >
                        {part.label === undefined ? (
                            body
                        ) : (
                            <Tooltip label={part.label} disabled={size === 'md' && !cut[i]}>
                                {body}
                            </Tooltip>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}
