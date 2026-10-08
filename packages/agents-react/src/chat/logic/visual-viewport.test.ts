import { describe, expect, test } from 'bun:test';
import { visualViewportGeometry } from './visual-viewport';

describe('a visual window in the timeline', () => {
    test('enters the chat at the start of its document, then follows the visible part', () => {
        expect(visualViewportGeometry(6000, 800, 300)).toEqual({ height: 800, top: 0 });
        expect(visualViewportGeometry(6000, 800, -1500)).toEqual({ height: 800, top: 1500 });
    });

    test('holds the final slice while the visual leaves, without another scroll region', () => {
        expect(visualViewportGeometry(6000, 800, -5600)).toEqual({ height: 800, top: 5200 });
        expect(visualViewportGeometry(6000, 800, -6500)).toEqual({ height: 800, top: 5200 });
    });

    test('short visuals keep their content height and changing viewport sizes update the slice', () => {
        expect(visualViewportGeometry(240, 800, -100)).toEqual({ height: 240, top: 0 });
        expect(visualViewportGeometry(6000, 500, -5400)).toEqual({ height: 500, top: 5400 });
    });

    test('preserves subpixel scroll positions without accumulated rounding', () => {
        expect(visualViewportGeometry(6000, 800, -1400.25).top).toBe(1400.25);
    });
});
