import { describe, expect, test } from 'bun:test';
import { containingIndex, moveIndex, nearestIndex, snapIndex } from './cursor.ts';

const HOUR = 3_600_000;
const hours = [0, 1, 2, 3].map((hour) => hour * HOUR);

describe('snapping', () => {
    test('finds the nearest bucket, the earlier one on a tie', () => {
        expect(nearestIndex(hours, 1.4 * HOUR)).toBe(1);
        expect(nearestIndex(hours, 1.6 * HOUR)).toBe(2);
        expect(nearestIndex(hours, 1.5 * HOUR)).toBe(1);
        expect(nearestIndex(hours, -HOUR)).toBe(0);
        expect(nearestIndex(hours, 9 * HOUR)).toBe(3);
        expect(nearestIndex([], 0)).toBe(-1);
    });

    test('a moment belongs to the bucket it falls in', () => {
        expect(containingIndex(hours, 1.9 * HOUR)).toBe(1);
        expect(containingIndex(hours, 3.5 * HOUR)).toBe(3);
        expect(containingIndex(hours, 5 * HOUR)).toBe(-1);
        expect(containingIndex(hours, -1)).toBe(-1);
    });

    test('with a step a bucket is that long, so a moment where a row is missing falls in none', () => {
        const gappy = [0, 1, 3].map((hour) => hour * HOUR);
        expect(containingIndex(gappy, 1.5 * HOUR, HOUR)).toBe(1);
        expect(containingIndex(gappy, 2.5 * HOUR, HOUR)).toBe(-1);
        expect(containingIndex(gappy, 3.9 * HOUR, HOUR)).toBe(2);
        expect(containingIndex(gappy, 4 * HOUR, HOUR)).toBe(-1);
    });

    test('on a time scale the cursor takes the bucket the pointer is in, as a marker does', () => {
        const deploy = 2.62 * HOUR;
        expect(snapIndex(hours, 'time', deploy, HOUR)).toBe(2);
        expect(snapIndex(hours, 'time', deploy, HOUR)).toBe(containingIndex(hours, deploy, HOUR));
    });

    test('a shared x snaps to its own buckets in each chart', () => {
        const other = [0, 2, 4].map((hour) => hour * HOUR);
        expect(snapIndex(hours, 'time', 2.9 * HOUR, HOUR)).toBe(2);
        expect(snapIndex(other, 'time', 2.9 * HOUR, 2 * HOUR)).toBe(1);
        expect(snapIndex(hours, 'linear', 2.9 * HOUR)).toBe(3);
        expect(snapIndex(['mon', 'tue'], 'band', 'tue')).toBe(1);
        expect(snapIndex(hours, 'time', null, HOUR)).toBe(-1);
    });
});

describe('the keyboard', () => {
    test('steps through the buckets and stops at the ends', () => {
        expect(moveIndex('ArrowRight', -1, 4)).toBe(0);
        expect(moveIndex('ArrowLeft', -1, 4)).toBe(3);
        expect(moveIndex('ArrowRight', 3, 4)).toBe(3);
        expect(moveIndex('ArrowLeft', 2, 4)).toBe(1);
        expect(moveIndex('Home', 2, 4)).toBe(0);
        expect(moveIndex('End', 0, 4)).toBe(3);
    });

    test('steps through rows with Up and Down and leaves Left and Right to the page', () => {
        expect(moveIndex('ArrowDown', -1, 4, [], 'rows')).toBe(0);
        expect(moveIndex('ArrowDown', 1, 4, [], 'rows')).toBe(2);
        expect(moveIndex('ArrowUp', 1, 4, [], 'rows')).toBe(0);
        expect(moveIndex('ArrowRight', 1, 4, [], 'rows')).toBeUndefined();
        expect(moveIndex('ArrowDown', 1, 4)).toBeUndefined();
    });

    test('Escape clears a cursor and leaves the key alone without one', () => {
        expect(moveIndex('Escape', 2, 4)).toBeNull();
        expect(moveIndex('Escape', -1, 4)).toBeUndefined();
        expect(moveIndex('a', 2, 4)).toBeUndefined();
    });

    test('Page Up and Page Down go to the first bucket of the previous and the next group', () => {
        const starts = [0, 2, 5];
        expect(moveIndex('PageDown', 3, 8, starts)).toBe(5);
        expect(moveIndex('PageDown', 6, 8, starts)).toBe(5);
        expect(moveIndex('PageUp', 3, 8, starts)).toBe(0);
        expect(moveIndex('PageDown', -1, 8, starts)).toBe(0);
        expect(moveIndex('PageDown', 1, 8)).toBeUndefined();
    });
});
