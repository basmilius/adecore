import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { fakeFormatSource } from '../testing/fake-source.ts';
import { formatAgo, formatClockDuration, formatCountdown, formatDuration, formatElapsedShort, formatPreciseDuration } from './duration.ts';
import { setFormatSource, type FormatSource } from './locale.ts';
import { FORMAT_SYSTEM } from './regions.ts';

const source = fakeFormatSource();
let previous: FormatSource;

beforeAll(() => {
    previous = setFormatSource(source);
});

afterAll(() => {
    setFormatSource(previous);
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const inRegion = (region: string): void => {
    source.set({ region });
};

afterEach(() => {
    source.set({ language: 'en' });
    inRegion(FORMAT_SYSTEM);
});

describe('how long something took', () => {
    test('climbs to the coarsest unit that still says something', () => {
        inRegion('en-US');
        expect(formatDuration(30_000)).toBe('30 s');
        expect(formatDuration(5 * MINUTE)).toBe('5 min');
        expect(formatDuration(90 * MINUTE)).toBe('1.5 h');
    });

    test('writes its decimal the way the region does', () => {
        inRegion('nl-NL');
        expect(formatDuration(90 * MINUTE)).toBe('1,5 h');
    });
});

describe('how long something has been running', () => {
    test('climbs from seconds to minutes to hours, two units at a time', () => {
        expect(formatElapsedShort(12_400)).toBe('12s');
        expect(formatElapsedShort(120_000)).toBe('2m');
        expect(formatElapsedShort(125_000)).toBe('2m 5s');
        expect(formatElapsedShort(3_780_000)).toBe('1h 3m');
        expect(formatElapsedShort(2 * HOUR)).toBe('2h');
    });

    // The live row counts a call that took a fraction of a second, and only a clock ahead of the start reads as nothing.
    test('rounds a fraction of a second up and a clock that runs ahead down to zero', () => {
        expect(formatElapsedShort(400)).toBe('1s');
        expect(formatElapsedShort(0)).toBe('0s');
        expect(formatElapsedShort(-5)).toBe('0s');
    });
});

describe('a stopwatch that is watched while it runs', () => {
    test('is minutes and seconds until it passes an hour', () => {
        expect(formatClockDuration(14_000)).toBe('00:14');
        expect(formatClockDuration(HOUR + 2 * MINUTE + 3_000)).toBe('1:02:03');
    });

    // A stopwatch floors: 14.9 seconds in, nothing has happened at 15 yet.
    test('floors its seconds and never runs backwards', () => {
        expect(formatClockDuration(14_900)).toBe('00:14');
        expect(formatClockDuration(-1_000)).toBe('00:00');
    });
});

describe('how long a short measurement took', () => {
    test('keeps the precision of each unit, and hands over to formatDuration from a minute', () => {
        inRegion('en-US');
        expect(formatPreciseDuration(0.42)).toBe('0.4 ms');
        expect(formatPreciseDuration(123.4)).toBe('123 ms');
        expect(formatPreciseDuration(1420)).toBe('1.42 s');
        expect(formatPreciseDuration(12_340)).toBe('12.3 s');
        expect(formatPreciseDuration(5 * MINUTE)).toBe('5 min');
    });

    test('rounds before it picks a unit, so a value at the edge moves up', () => {
        inRegion('en-US');
        expect(formatPreciseDuration(9.96)).toBe('10 ms');
        expect(formatPreciseDuration(999.6)).toBe('1 s');
        expect(formatPreciseDuration(9_996)).toBe('10 s');
        expect(formatPreciseDuration(59_990)).toBe('1 min');
    });
});

describe('how long a window still has', () => {
    test('is two units wide until it comes down to minutes', () => {
        inRegion('nl-NL');
        expect(formatCountdown(4 * DAY + 3 * HOUR)).toBe('4d 3h');
        expect(formatCountdown(12 * HOUR + 8 * MINUTE)).toBe('12h 8m');
        expect(formatCountdown(9 * MINUTE)).toBe('9m');
    });

    // Under a minute the window is all but gone, and `0m` reads as spent rather than as nearly so.
    test('never counts down to zero minutes', () => {
        expect(formatCountdown(10_000)).toBe('1m');
        expect(formatCountdown(0)).toBe('1m');
    });
});

describe('how long ago something was', () => {
    test('says so in words under a minute and in units above it', () => {
        expect(formatAgo(30_000)).toBe('now');
        expect(formatAgo(3 * MINUTE)).toBe('3m ago');
        expect(formatAgo(5 * HOUR)).toBe('5h ago');
        expect(formatAgo(9 * DAY)).toBe('9d ago');
    });

    test('reads a clock that runs ahead as now rather than as the future', () => {
        expect(formatAgo(-5000)).toBe('now');
    });

    test('is written in the language of the interface', () => {
        source.set({ language: 'nl' });
        expect(formatAgo(30_000)).toBe('nu');
        expect(formatAgo(3 * MINUTE)).toBe('3 min. geleden');
        expect(formatAgo(5 * HOUR)).toBe('5 uur geleden');
    });
});
