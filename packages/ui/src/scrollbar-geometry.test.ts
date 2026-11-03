import { describe, expect, test } from 'bun:test';
import { MIN_THUMB, overflows, pageToward, scrollAfterDrag, thumbOf } from './scrollbar-geometry.ts';

describe('an overlay scrollbar thumb', () => {
    test('is as long a share of the track as the view is of the content', () => {
        expect(thumbOf({ track: 400, view: 400, content: 1600 }, 0)).toEqual({ size: 100, offset: 0 });
    });

    test('runs from the start of the track to its end as the content scrolls through', () => {
        const metrics = { track: 400, view: 400, content: 1600 };
        expect(thumbOf(metrics, 600).offset).toBe(150);
        expect(thumbOf(metrics, 1200).offset).toBe(300);
    });

    test('keeps a length a pointer can grab over a very long content', () => {
        expect(thumbOf({ track: 300, view: 300, content: 100_000 }, 0).size).toBe(MIN_THUMB);
        expect(thumbOf({ track: 300, view: 300, content: 100_000 }, 99_700).offset).toBe(300 - MIN_THUMB);
    });

    test('lands on whole pixels', () => {
        const { size, offset } = thumbOf({ track: 333, view: 333, content: 1000 }, 123.4);
        expect(Number.isInteger(size)).toBe(true);
        expect(Number.isInteger(offset)).toBe(true);
    });

    test('stays inside the track when the scroll overshoots, as an elastic scroll does', () => {
        const metrics = { track: 400, view: 400, content: 1600 };
        expect(thumbOf(metrics, -40).offset).toBe(0);
        expect(thumbOf(metrics, 1300).offset).toBe(300);
    });
});

describe('an axis', () => {
    test('overflows only by more than a pixel of rounding', () => {
        expect(overflows(400, 401)).toBe(false);
        expect(overflows(400, 402)).toBe(true);
    });
});

describe('a thumb drag', () => {
    test('scrolls the content as far as the thumb moved, scaled to the content', () => {
        const metrics = { track: 400, view: 400, content: 1600 };
        expect(scrollAfterDrag(metrics, 0, 150)).toBe(600);
        expect(scrollAfterDrag(metrics, 600, -75)).toBe(300);
    });

    test('stops at either end', () => {
        const metrics = { track: 400, view: 400, content: 1600 };
        expect(scrollAfterDrag(metrics, 0, -50)).toBe(0);
        expect(scrollAfterDrag(metrics, 1000, 400)).toBe(1200);
    });
});

describe('a press on the track', () => {
    test('pages toward the pointer by most of the view', () => {
        expect(pageToward(20, 100, 200, 400)).toBe(-360);
        expect(pageToward(300, 100, 200, 400)).toBe(360);
    });

    test('does nothing on the thumb', () => {
        expect(pageToward(150, 100, 200, 400)).toBe(0);
    });
});
