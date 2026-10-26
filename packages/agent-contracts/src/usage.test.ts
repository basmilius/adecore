import { describe, expect, test } from 'bun:test';
import { evenPace, type UsageWindow } from './usage.ts';

describe('the even pace of a window', () => {
    const HOUR = 3_600_000;

    const window = (used: number, extra: Partial<UsageWindow> = {}): UsageWindow => ({
        id: 'session',
        kind: 'session',
        label: 'Session',
        used,
        resetsAt: 10 * HOUR,
        durationMs: 5 * HOUR,
        ...extra
    });

    test('stands where an evenly spent window would be by now, and says which side of it the usage is', () => {
        // Two of the five hours have run, so an even spread stands at 40%.
        expect(evenPace(window(0.6), 7 * HOUR)).toEqual({ percent: 40, standing: 'ahead' });
        expect(evenPace(window(0.2), 7 * HOUR)).toEqual({ percent: 40, standing: 'behind' });
        expect(evenPace(window(0.4), 7 * HOUR)).toEqual({ percent: 40, standing: 'even' });
    });

    test('stays inside the window before it starts and after it resets', () => {
        expect(evenPace(window(0), 4 * HOUR)?.percent).toBe(0);
        expect(evenPace(window(1), 11 * HOUR)?.percent).toBe(100);
    });

    test('is left out when the CLI named no reset or no length', () => {
        expect(evenPace(window(0.5, { resetsAt: null }), 7 * HOUR)).toBeNull();
        expect(evenPace(window(0.5, { durationMs: null }), 7 * HOUR)).toBeNull();
        expect(evenPace(window(0.5, { durationMs: 0 }), 7 * HOUR)).toBeNull();
    });
});
