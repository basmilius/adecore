import { describe, expect, test } from 'bun:test';
import { matchingItems, toggleGroup } from './legend.ts';
import { frontierOf, movePoint, nearestPoint, spreadLabels } from './points.ts';

describe('the nearest point', () => {
    const points = [
        { index: 0, x: 10, y: 10 },
        { index: 1, x: 40, y: 10 },
        { index: 2, x: 30, y: 30 }
    ];

    test('is the closest within reach', () => {
        expect(nearestPoint(points, 33, 26, 16)).toBe(2);
        expect(nearestPoint(points, 12, 12, 16)).toBe(0);
    });

    test('is none when every point lies farther than the reach', () => {
        expect(nearestPoint(points, 80, 80, 16)).toBe(-1);
    });
});

describe('moving between points', () => {
    // Two series, the second with a gap left out of its points.
    const lines = [[0, 1, 2], [], [4, 6]];

    test('Left and Right move along a series and stop at its ends', () => {
        expect(movePoint(lines, 1, 'ArrowRight')).toBe(2);
        expect(movePoint(lines, 2, 'ArrowRight')).toBe(2);
        expect(movePoint(lines, 0, 'ArrowLeft')).toBe(0);
    });

    test('Up and Down go to the same place in the next series that has points, as far as it reaches', () => {
        expect(movePoint(lines, 2, 'ArrowDown')).toBe(6);
        expect(movePoint(lines, 4, 'ArrowUp')).toBe(0);
    });

    test('the first key without a cursor starts at an end, and Escape clears', () => {
        expect(movePoint(lines, -1, 'ArrowRight')).toBe(0);
        expect(movePoint(lines, -1, 'End')).toBe(6);
        expect(movePoint(lines, 1, 'Escape')).toBeNull();
        expect(movePoint(lines, -1, 'Escape')).toBeUndefined();
        expect(movePoint(lines, 1, 'a')).toBeUndefined();
    });
});

describe('the frontier', () => {
    const points = [
        { x: 1, y: 40 },
        { x: 2, y: 38 },
        { x: 3, y: 55 },
        { x: 5, y: 55 },
        { x: 8, y: 70 }
    ];

    test('keeps the points nothing beats on a lower x and a higher y, in order of x', () => {
        expect(frontierOf(points)).toEqual([points[0]!, points[2]!, points[4]!]);
    });

    test('turns around where a higher x is the better one', () => {
        expect(frontierOf(points, false)).toEqual([points[4]!]);
    });
});

describe('end labels', () => {
    test('stay at their wish when they do not collide', () => {
        expect(spreadLabels([20, 100, 60], 24, 0, 200)).toEqual([20, 100, 60]);
    });

    test('push apart in both directions and stay inside the plot, in the order given', () => {
        expect(spreadLabels([50, 40, 45], 24, 0, 200)).toEqual([88, 40, 64]);
        expect(spreadLabels([195, 198], 24, 0, 192)).toEqual([168, 192]);
        expect(spreadLabels([2], 24, 10, 192)).toEqual([10]);
    });

    test('come closer than the gap where they do not fit, and stay inside the plot', () => {
        expect(spreadLabels([50, 50, 50, 50, 50], 24, 0, 60)).toEqual([0, 15, 30, 45, 60]);
    });
});

describe('the series legend', () => {
    const items = [
        { key: 'a', label: 'Atlas 5', group: 'north' },
        { key: 'b', label: 'Atlas 5 mini', group: 'north' },
        { key: 'c', label: 'Lumen', name: 'South Lumen', group: 'south', disabled: true }
    ];

    test('finds the items whose label or full name holds the search, whatever the case', () => {
        expect(matchingItems(items, ' MINI ').map((item) => item.key)).toEqual(['b']);
        expect(matchingItems(items, 'south').map((item) => item.key)).toEqual(['c']);
        expect(matchingItems(items, '')).toHaveLength(3);
    });

    test('turns a group on or off as a whole and leaves a disabled series and other groups be', () => {
        expect(toggleGroup(items, ['x'], 'north', false)).toEqual(['x', 'a', 'b']);
        expect(toggleGroup(items, ['a', 'x'], 'north', true)).toEqual(['x']);
        expect(toggleGroup(items, [], 'south', false)).toEqual([]);
    });
});
