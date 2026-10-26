import { describe, expect, test } from 'bun:test';
import { bucketStepOf, continuousXScale, decadesOf, decimalsOf, extentOf, pointXScale, stackSeries, thinTicks, yScaleOf } from './scale.ts';

describe('stacking', () => {
    test('piles a series on the ones before it in the same stack and leaves the others on zero', () => {
        const stacked = stackSeries(
            [
                { id: 'input', values: [3, 1], stack: 'tokens' },
                { id: 'output', values: [2, null], stack: 'tokens' },
                { id: 'errors', values: [5, 4], stack: null }
            ],
            2
        );

        expect(stacked.get('output')).toEqual({ base: [3, 1], top: [5, null] });
        expect(stacked.get('errors')).toEqual({ base: [0, 0], top: [5, 4] });
    });

    test('piles negative values downward, apart from the positive ones', () => {
        const stacked = stackSeries(
            [
                { id: 'in', values: [4], stack: 'flow' },
                { id: 'out', values: [-3], stack: 'flow' },
                { id: 'more', values: [-2], stack: 'flow' }
            ],
            1
        );

        expect(stacked.get('more')).toEqual({ base: [-3], top: [-5] });
    });

    test('the domain covers the top of a stack, not only its largest series', () => {
        const stacked = stackSeries(
            [
                { id: 'input', values: [40, 10], stack: 'tokens' },
                { id: 'output', values: [30, 5], stack: 'tokens' }
            ],
            2
        );

        const scale = yScaleOf('linear', extentOf(stacked.values(), 'linear'), {}, [200, 0], 5);
        expect(scale.domain).toEqual([0, 70]);
    });
});

describe('the value axis', () => {
    test('starts at zero and rounds its top out to a tick', () => {
        const scale = yScaleOf('linear', [12, 87], {}, [100, 0], 5);
        expect(scale.domain).toEqual([0, 100]);
        expect(scale.ticks).toEqual([0, 20, 40, 60, 80, 100]);
        expect(scale.at(50)).toBe(50);
    });

    test('leaves a step over a value on a tick, or ends at the highest value', () => {
        expect(yScaleOf('linear', [0, 80], {}, [100, 0], 5).domain).toEqual([0, 80]);
        expect(yScaleOf('linear', [0, 80], { headroom: 'step' }, [100, 0], 5).domain).toEqual([0, 100]);
        expect(yScaleOf('linear', [0, 87], { headroom: 'step' }, [100, 0], 5).domain).toEqual([0, 100]);
        const flush = yScaleOf('linear', [0, 87], { headroom: 'none' }, [100, 0], 5);
        expect(flush.domain).toEqual([0, 87]);
        expect(flush.at(87)).toBe(0);
    });

    test('keeps the ends the caller fixed', () => {
        const scale = yScaleOf('linear', [12, 87], { min: 10, max: 90 }, [100, 0], 5);
        expect(scale.domain).toEqual([10, 90]);
    });

    test('a count keeps whole ticks, also when the values are small', () => {
        const scale = yScaleOf('linear', [0, 2], { integer: true }, [100, 0], 8);
        expect(scale.ticks.every(Number.isInteger)).toBe(true);
        expect(scale.ticks).toEqual([0, 1, 2]);
    });

    test('a chart without values still has an axis', () => {
        expect(yScaleOf('linear', null, {}, [100, 0], 5).domain).toEqual([0, 1]);
    });

    test('a log scale ticks on the decades and cannot place zero', () => {
        const scale = yScaleOf('log', [3, 4200], {}, [100, 0], 5);
        expect(scale.domain).toEqual([1, 10000]);
        expect(scale.ticks).toEqual([1, 10, 100, 1000, 10000]);
        expect(scale.at(0)).toBeNull();
    });

    test('covers the values it must include and rounds out above them, while larger data still wins', () => {
        expect(yScaleOf('linear', [0, 0.2], { include: [1] }, [100, 0], 4).domain).toEqual([0, 1]);
        expect(yScaleOf('linear', [0, 0.2], { include: [0.9] }, [100, 0], 4).domain).toEqual([0, 1]);
        expect(yScaleOf('linear', [0, 7.4], { include: [1] }, [100, 0], 4).domain).toEqual([0, 8]);
    });

    test('a tick step decides the decimals of its labels', () => {
        expect(decimalsOf(20)).toBe(0);
        expect(decimalsOf(0.5)).toBe(1);
        expect(decimalsOf(0.25)).toBe(2);
        expect(decimalsOf(0.1 + 0.2)).toBe(1);
    });
});

describe('the axes of a point chart', () => {
    test('a log x axis runs over whole decades and ticks on each', () => {
        expect(decadesOf([0.03, 4])).toEqual({ low: -2, high: 1 });
        expect(decadesOf([5, 5])).toEqual({ low: 0, high: 1 });
        const scale = pointXScale('log', [0.03, 4], [0, 300]);
        expect(scale.domain).toEqual([0.01, 10]);
        expect(scale.ticks(10)).toEqual([0.01, 0.1, 1, 10]);
        expect(scale.at(1)).toBeCloseTo(200);
    });

    test('a narrow axis keeps both ends and decades evenly apart between them', () => {
        expect(thinTicks([1, 10, 100, 1000, 10000], 2)).toEqual([1, 100, 10000]);
        expect(thinTicks([1, 10, 100], 5)).toEqual([1, 10, 100]);
        expect(thinTicks([1, 10, 100, 1e3, 1e4, 1e5, 1e6], 3)).toEqual([1, 100, 1e4, 1e6]);
        expect(thinTicks([1, 10, 100, 1e3, 1e4, 1e5, 1e6], 2)).toEqual([1, 1e3, 1e6]);
        expect(thinTicks([1, 10, 100, 1e3, 1e4, 1e5], 3)).toEqual([1, 1e5]);
    });

    test('a linear x axis rounds out to a tick from the ends the caller fixed', () => {
        expect(pointXScale('linear', [3, 47], [0, 100]).domain).toEqual([0, 50]);
        expect(pointXScale('linear', [13, 47], [0, 100], { min: 0 }).domain).toEqual([0, 50]);
    });

    test('a value axis with a step ticks on it and leaves zero out where points need no ground', () => {
        const scale = yScaleOf('linear', [23, 71], { step: 10 }, [100, 0], 5, false);
        expect(scale.domain).toEqual([20, 80]);
        expect(scale.ticks).toEqual([20, 30, 40, 50, 60, 70, 80]);
        expect(yScaleOf('linear', [23, 71], { step: 10 }, [100, 0], 5).domain).toEqual([0, 80]);
        expect(extentOf([{ base: [0, 0], top: [23, 71] }], 'linear', false)).toEqual([23, 71]);
    });
});

describe('the buckets of a time scale', () => {
    const HOUR = 3_600_000;

    test('are as long as the smallest distance between two rows, so a missing row does not stretch them', () => {
        expect(bucketStepOf([0, HOUR, 3 * HOUR])).toBe(HOUR);
        expect(bucketStepOf([5])).toBe(0);
    });

    test('run the axis to the end of the last bucket, so its point stands in the middle of it', () => {
        const scale = continuousXScale('time', [0, HOUR], [0, 200], HOUR);
        expect(scale.domain).toEqual([0, 2 * HOUR]);
        expect(scale.at(HOUR + HOUR / 2)).toBe(150);
    });
});
