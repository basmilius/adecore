import { useMemo, useRef, type KeyboardEvent, type PointerEvent, type Ref } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { formatClockDuration } from './format/duration.ts';
import { mergeRefs } from './merge-refs.ts';
import { useMeasuredWidth } from './useMeasuredWidth.ts';

/* About one bar per 3px, each 2px wide; a bar sits at its own time, so it lines up with the marks and the playhead. */
const BAR_PITCH = 3;
const BAR_WIDTH = 2;

/* The height of a silent bar, so silence still reads as a line. */
const SILENCE = 0.04;

/* Page Up and Page Down move this many steps, as a Base UI slider does. */
const PAGE_STEPS = 10;

/* The loudest sample under each bar, or null for a bar past either end of the audio. */
const barsOf = (levels: readonly number[], duration: number, from: number, to: number, count: number): (number | null)[] => {
    if (count <= 0 || levels.length === 0 || duration <= 0 || to <= from) {
        return [];
    }
    const perSecond = levels.length / duration;
    return Array.from({ length: count }, (_, i) => {
        const start = from + ((to - from) * i) / count;
        const end = from + ((to - from) * (i + 1)) / count;
        if (end <= 0 || start >= duration) {
            return null;
        }
        const first = Math.max(0, Math.floor(start * perSecond));
        const last = Math.min(levels.length - 1, Math.max(first, Math.ceil(end * perSecond) - 1));
        let level = 0;
        for (let index = first; index <= last; index++) {
            level = Math.max(level, levels[index] ?? 0);
        }
        return Math.min(1, Math.max(SILENCE, level));
    });
};

export interface WaveformProps {
    /* The loudness as samples spread evenly over the duration, from 0 for silence to 1 for the loudest, at any rate. */
    levels: readonly number[];
    /* In seconds. */
    duration: number;
    /* The stretch it shows, in seconds, such as the visible part of a zoomed timeline. Defaults to the whole. */
    range?: readonly [from: number, to: number];
    /* How far it has played, in seconds. Left out, the waveform draws no playhead. */
    value?: number;
    /* Seeks to a time in seconds. Without it the waveform only shows. */
    onValueChange?(value: number): void;
    /* The time a drag lets go at, and the one a key moved to: where a player resumes what it held during the drag. */
    onValueCommitted?(value: number): void;
    /* How far an arrow key moves the playhead, in seconds. */
    step?: number;
    /* Hears a key before the waveform does. A key it calls `preventDefault` on, the waveform leaves alone and lets
       bubble, for a player around it that binds the key to something else. */
    onKeyDown?(e: KeyboardEvent<HTMLDivElement>): void;
    /* Times in seconds drawn as lines through the waveform, such as cuts. */
    marks?: readonly number[];
    label: string;
    /* Its height, which the waveform fills. */
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* The loudness of a piece of audio over time, played up to the playhead, where a press or a drag seeks. */
export function Waveform({
    levels,
    duration,
    range,
    value,
    onValueChange,
    onValueCommitted,
    step = 1,
    onKeyDown,
    marks = [],
    label,
    className,
    ref
}: WaveformProps) {
    const { t } = useTranslation('ui');
    const [measure, width] = useMeasuredWidth();
    const rootRef = useMemo(() => mergeRefs(ref, measure), [ref, measure]);
    const dragged = useRef(0);
    const [from, to] = range ?? [0, duration];
    const span = to - from;
    const count = Math.floor(width / BAR_PITCH);
    const bars = useMemo(() => barsOf(levels, duration, from, to, count), [levels, duration, from, to, count]);

    const positionOf = (time: number): number => (span > 0 ? (time - from) / span : 0);
    const inView = (time: number): boolean => positionOf(time) >= 0 && positionOf(time) <= 1;
    const clamp = (time: number): number => Math.min(duration, Math.max(0, time));

    const seekAt = (e: PointerEvent<HTMLDivElement>): void => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width > 0) {
            dragged.current = clamp(from + ((e.clientX - rect.left) / rect.width) * span);
            onValueChange?.(dragged.current);
        }
    };

    const letGo = (e: PointerEvent<HTMLDivElement>): void => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
            onValueCommitted?.(dragged.current);
        }
    };

    const moveByKey = (e: KeyboardEvent<HTMLDivElement>): void => {
        onKeyDown?.(e);
        if (e.defaultPrevented) {
            return;
        }
        const at = value ?? 0;
        const moves: Record<string, number> = {
            ArrowLeft: at - step,
            ArrowDown: at - step,
            ArrowRight: at + step,
            ArrowUp: at + step,
            PageDown: at - step * PAGE_STEPS,
            PageUp: at + step * PAGE_STEPS,
            Home: 0,
            End: duration
        };
        const next = moves[e.key];
        if (next === undefined) {
            return;
        }
        // The slider owns these keys; a transport listening higher up would move the playhead a second time.
        e.preventDefault();
        e.stopPropagation();
        onValueChange?.(clamp(next));
        onValueCommitted?.(clamp(next));
    };

    const slider =
        onValueChange === undefined
            ? { role: 'img' }
            : {
                  role: 'slider',
                  tabIndex: 0,
                  'aria-valuemin': 0,
                  'aria-valuemax': duration,
                  'aria-valuenow': value ?? 0,
                  'aria-valuetext': t('waveform.position', {
                      time: formatClockDuration((value ?? 0) * 1000),
                      duration: formatClockDuration(duration * 1000)
                  }),
                  onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      seekAt(e);
                  },
                  onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                          seekAt(e);
                      }
                  },
                  onPointerUp: letGo,
                  onPointerCancel: letGo,
                  onKeyDown: moveByKey
              };

    return (
        <div
            ref={rootRef}
            aria-label={label}
            {...slider}
            className={clsx('relative select-none', onValueChange !== undefined && 'focus-ring cursor-ew-resize touch-none', className)}
        >
            <svg className="absolute inset-0 size-full" viewBox={`0 0 ${Math.max(1, width)} 100`} preserveAspectRatio="none" aria-hidden>
                {bars.map((level, i) => {
                    if (level === null) {
                        return null;
                    }
                    const center = from + (span * (i + 0.5)) / count;
                    return (
                        <rect
                            key={i}
                            x={Math.round((i * width) / count)}
                            y={(100 - level * 100) / 2}
                            width={BAR_WIDTH}
                            height={level * 100}
                            className={value !== undefined && center <= value ? 'fill-accent' : 'fill-text-faint'}
                        />
                    );
                })}
                {marks.filter(inView).map((mark) => {
                    const x = Math.round(positionOf(mark) * width) + 0.5;
                    return (
                        <line key={mark} x1={x} x2={x} y1={0} y2={100} strokeWidth={1} vectorEffect="non-scaling-stroke" className="stroke-accent opacity-60" />
                    );
                })}
            </svg>
            {value !== undefined && inView(value) && (
                <span className="pointer-events-none absolute inset-y-0 w-px bg-accent" style={{ left: `${positionOf(value) * 100}%` }} />
            )}
        </div>
    );
}
