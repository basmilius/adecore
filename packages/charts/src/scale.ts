import { scaleLinear, scaleLog, scaleTime } from 'd3-scale';
import type { ChartXOptions, ChartYOptions, ChartYScale } from './types.ts';

export interface StackInput {
    readonly id: string;
    readonly values: readonly (number | null)[];
    /* Series with the same stack key pile up in the order they are listed; without one a series stands on zero. */
    readonly stack: string | null;
}

export interface Stacked {
    readonly base: readonly number[];
    /* Null where the series has no value, which breaks a line. */
    readonly top: readonly (number | null)[];
}

/* Where each series starts and ends per bucket. Negative values pile downward, apart from the positive ones. */
export function stackSeries(series: readonly StackInput[], count: number): Map<string, Stacked> {
    const result = new Map<string, Stacked>();
    const piles = new Map<string, { up: number[]; down: number[] }>();

    for (const { id, values, stack } of series) {
        if (stack === null) {
            result.set(id, { base: Array.from({ length: count }, () => 0), top: Array.from({ length: count }, (_, i) => values[i] ?? null) });

            continue;
        }

        let pile = piles.get(stack);

        if (pile === undefined) {
            pile = { up: Array.from({ length: count }, () => 0), down: Array.from({ length: count }, () => 0) };
            piles.set(stack, pile);
        }

        const base: number[] = [];
        const top: (number | null)[] = [];

        for (let i = 0; i < count; i++) {
            const value = values[i] ?? null;
            const side = value !== null && value < 0 ? pile.down : pile.up;
            base.push(side[i]!);

            if (value === null) {
                top.push(null);

                continue;
            }

            side[i] = side[i]! + value;
            top.push(side[i]!);
        }

        result.set(id, { base, top });
    }

    return result;
}

/* The lowest and highest value any series reaches, stacked tops included, or null without a value. Without `ground` the bases are left out, as points have none. */
export function extentOf(stacked: Iterable<Stacked>, kind: ChartYScale, ground = true): [number, number] | null {
    let low = Infinity;
    let high = -Infinity;

    for (const { base, top } of stacked) {
        for (let i = 0; i < top.length; i++) {
            const value = top[i];

            if (value === null || value === undefined || (kind === 'log' && value <= 0)) {
                continue;
            }

            const floor = kind === 'log' || !ground ? value : base[i]!;
            low = Math.min(low, value, floor);
            high = Math.max(high, value, floor);
        }
    }

    return low === Infinity ? null : [low, high];
}

export interface YAxisScale {
    readonly domain: readonly [number, number];
    readonly ticks: readonly number[];
    /* The pixel of a value, unrounded; null for a value a log scale cannot show. */
    at(value: number): number | null;
}

/* Ticks every `step` from `low` to `high`, both rounded out to it. */
function steppedScale(low: number, high: number, step: number, options: ChartYOptions, range: [number, number]): YAxisScale {
    const start = options.min ?? Math.floor(low / step) * step;
    let end = options.max ?? Math.ceil(high / step) * step;

    if (end <= start) {
        end = start + step;
    }

    const scale = scaleLinear().domain([start, end]).range(range);
    const ticks: number[] = [];

    for (let tick = Math.ceil(start / step) * step; tick <= end + step / 1e6; tick += step) {
        ticks.push(Number(tick.toFixed(10)));
    }

    return { domain: [start, end], ticks, at: (value) => scale(value) };
}

/*
 * The value axis over the extent of the data: a linear axis includes zero, so a column stands on the
 * ground, and rounds its ends out to a tick unless the caller fixed them. A count keeps whole ticks.
 * Points need no ground, so `ground` false leaves zero out.
 */
export function yScaleOf(
    kind: ChartYScale,
    data: [number, number] | null,
    options: ChartYOptions,
    range: [number, number],
    count: number,
    ground = true
): YAxisScale {
    const include = (options.include ?? []).filter((value) => kind !== 'log' || value > 0);

    const extent: [number, number] | null =
        include.length === 0 ? data : [Math.min(data?.[0] ?? Infinity, ...include), Math.max(data?.[1] ?? -Infinity, ...include)];

    if (kind === 'log') {
        const low = options.min ?? Math.max(extent?.[0] ?? 1, Number.MIN_VALUE);
        const high = options.max ?? Math.max(extent?.[1] ?? 10, low * 10);
        const scale = scaleLog().domain([low, high]).range(range);

        if (options.min === undefined || options.max === undefined) {
            scale.nice();
        }

        const [min, max] = scale.domain() as [number, number];
        const domain: [number, number] = [options.min ?? min, options.max ?? max];
        scale.domain(domain);
        const ticks = scale.ticks(count).filter((tick) => Math.log10(tick) % 1 === 0);

        return { domain, ticks: ticks.length >= 2 ? ticks : scale.ticks(count), at: (value) => (value > 0 ? scale(value) : null) };
    }

    const floor = ground ? 0 : (extent?.[0] ?? 0);
    const ceiling = ground ? 0 : (extent?.[1] ?? 0);

    if (options.step !== undefined && options.step > 0) {
        return steppedScale(Math.min(floor, extent?.[0] ?? 0), Math.max(ceiling, extent?.[1] ?? 0), options.step, options, range);
    }

    let low = options.min ?? Math.min(floor, extent?.[0] ?? 0);
    let high = options.max ?? Math.max(ceiling, extent?.[1] ?? 0);

    if (high <= low) {
        high = low + (options.integer === true ? count : 1);
    }

    if (options.integer === true && options.max === undefined) {
        high = Math.max(high, low + 1);
    }

    const top = high;
    const scale = scaleLinear().domain([low, high]).range(range);
    scale.nice(count);
    [low, high] = scale.domain() as [number, number];

    if (options.max === undefined && options.headroom === 'none') {
        high = top;
    } else if (options.max === undefined && options.headroom === 'step' && top > 0 && high === top) {
        // The highest value lands on a tick, so the axis goes one tick further to keep air over it.
        const ticked = scale.ticks(count);
        high += ticked.length > 1 ? ticked[1]! - ticked[0]! : top;
    }

    const domain: [number, number] = [options.min ?? low, options.max ?? high];
    scale.domain(domain);
    let ticks = scale.ticks(count);

    if (options.integer === true) {
        ticks = ticks.filter((tick) => Number.isInteger(tick));
    }

    return { domain, ticks, at: (value) => scale(value) };
}

/* As many ticks as fit at one per this many pixels, so a short chart does not crowd its axis. */
export function tickCount(length: number, spacing: number): number {
    return Math.max(2, Math.floor(length / spacing));
}

export interface ContinuousXScale {
    readonly domain: readonly [number, number];
    at(value: number): number;
    invert(pixel: number): number;
    ticks(count: number): number[];
}

/* The smallest distance between two rows, so a row that is missing does not make every bucket twice as long; 0 for one row. */
export function bucketStepOf(xs: readonly number[]): number {
    let step = Infinity;

    for (let i = 1; i < xs.length; i++) {
        const distance = xs[i]! - xs[i - 1]!;

        if (distance > 0) {
            step = Math.min(step, distance);
        }
    }

    return step === Infinity ? 0 : step;
}

/* The whole decades around the positive values, at least one apart: `[0.03, 4]` lies in 10^-2 to 10^1. */
export function decadesOf(values: readonly number[]): { readonly low: number; readonly high: number } {
    const positive = values.filter((value) => value > 0 && Number.isFinite(value));

    if (positive.length === 0) {
        return { low: 0, high: 1 };
    }

    const low = Math.floor(Math.log10(Math.min(...positive)));
    const high = Math.ceil(Math.log10(Math.max(...positive)));

    return { low, high: high > low ? high : low + 1 };
}

/*
 * At most `count` intervals out of the ticks, every second, third or later one, keeping both ends. The stride divides
 * the axis, so the ticks stay evenly apart; where none does within `count`, only the ends are left.
 */
export function thinTicks(ticks: readonly number[], count: number): number[] {
    const intervals = ticks.length - 1;

    if (intervals <= 1 || intervals <= count) {
        return [...ticks];
    }

    let stride = Math.ceil(intervals / Math.max(1, count));

    while (intervals % stride !== 0) {
        stride++;
    }

    return ticks.filter((_, i) => i % stride === 0);
}

/* A log axis in decades, ticking on each decade as far as they fit. */
function logXScale(values: readonly number[], range: [number, number]): ContinuousXScale {
    const { low, high } = decadesOf(values);
    const decades = Array.from({ length: high - low + 1 }, (_, i) => 10 ** (low + i));

    const scale = scaleLog()
        .domain([10 ** low, 10 ** high])
        .range(range);

    return {
        domain: [10 ** low, 10 ** high],
        at: (value) => (value > 0 ? scale(value) : Number.NaN),
        invert: (pixel) => scale.invert(pixel),
        ticks: (count) => thinTicks(decades, count)
    };
}

/* The x axis of a point chart: it covers every point, rounded out to a tick, or the ends the caller fixed. */
export function pointXScale(kind: 'time' | 'linear' | 'log', xs: readonly number[], range: [number, number], options: ChartXOptions = {}): ContinuousXScale {
    const finite = xs.filter((value) => Number.isFinite(value));

    if (kind === 'log') {
        return logXScale([...finite, ...(options.min === undefined ? [] : [options.min]), ...(options.max === undefined ? [] : [options.max])], range);
    }

    if (kind === 'time') {
        return continuousXScale('time', finite, range);
    }

    let low = options.min ?? (finite.length === 0 ? 0 : Math.min(...finite));
    let high = options.max ?? (finite.length === 0 ? 1 : Math.max(...finite));

    if (high <= low) {
        high = low + 1;
    }

    const scale = scaleLinear().domain([low, high]).range(range).nice();
    [low, high] = scale.domain() as [number, number];
    scale.domain([options.min ?? low, options.max ?? high]);
    const domain = scale.domain() as [number, number];

    return { domain, at: (value) => scale(value), invert: (pixel) => scale.invert(pixel), ticks: (count) => scale.ticks(count) };
}

/* A time, linear or log x axis over the buckets, from the first to the end of the last, which is `step` long, or between the ends the caller fixed. */
export function continuousXScale(
    kind: 'time' | 'linear' | 'log',
    xs: readonly number[],
    range: [number, number],
    step = 0,
    options: ChartXOptions = {}
): ContinuousXScale {
    if (kind === 'log') {
        return logXScale(xs, range);
    }

    let low = options.min ?? (xs.length === 0 ? 0 : Math.min(...xs));
    let high = options.max ?? (xs.length === 0 ? 1 : Math.max(...xs) + step);

    if (high <= low) {
        const pad = kind === 'time' ? 30 * 60 * 1000 : 1;
        high = low + pad;
        low -= pad;
    }

    if (kind === 'time') {
        const scale = scaleTime().domain([low, high]).range(range);

        return {
            domain: [low, high],
            at: (value) => scale(value),
            invert: (pixel) => scale.invert(pixel).getTime(),
            ticks: (count) => scale.ticks(count).map((tick) => tick.getTime())
        };
    }

    const scale = scaleLinear().domain([low, high]).range(range);

    return { domain: [low, high], at: (value) => scale(value), invert: (pixel) => scale.invert(pixel), ticks: (count) => scale.ticks(count) };
}

/* The number of decimals a step between ticks needs, so `0.25` gets two and `5` none. */
export function decimalsOf(step: number): number {
    if (!Number.isFinite(step) || step <= 0) {
        return 0;
    }

    // Through a fixed width first, so the float noise of `0.1 + 0.2` does not count as digits.
    const fraction = String(Number(step.toFixed(6))).split('.')[1];

    return fraction?.length ?? 0;
}
