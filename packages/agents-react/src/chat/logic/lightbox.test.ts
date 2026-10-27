import { describe, expect, test } from 'bun:test';
import { MAX_SCALE, START, stepped, wheeled, zoomed, type Bounds } from './lightbox';

const bounds: Bounds = { image: { width: 400, height: 300 }, frame: { width: 800, height: 600 } };
const middle = { x: 0, y: 0 };

describe('wheeled', () => {
    test('a pinch out zooms in around the fingers', () => {
        const view = wheeled({ scale: 2, x: 0, y: 0 }, { deltaX: 0, deltaY: -20, ctrlKey: true }, { x: 100, y: 50 }, bounds);

        expect(view.scale).toBeCloseTo(2 * Math.exp(0.2));
        expect(view.x).toBeLessThan(0);
        expect(view.y).toBeLessThan(0);
    });

    test('a pinch in past the start returns to the centered picture', () => {
        const view = wheeled({ scale: 1.1, x: 10, y: 0 }, { deltaX: 0, deltaY: 40, ctrlKey: true }, middle, bounds);

        expect(view).toEqual(START);
    });

    test('a mouse notch with Ctrl zooms no further than a large pinch', () => {
        const view = wheeled(START, { deltaX: 0, deltaY: -1000, ctrlKey: true }, middle, bounds);

        expect(view.scale).toBeCloseTo(Math.exp(0.5));
    });

    test('two fingers pan a zoomed picture against the direction of the scroll', () => {
        const view = wheeled({ scale: 4, x: 0, y: 0 }, { deltaX: 30, deltaY: -20, ctrlKey: false }, middle, bounds);

        expect(view).toEqual({ scale: 4, x: -30, y: 20 });
    });

    test('two fingers leave an unzoomed picture where it is', () => {
        expect(wheeled(START, { deltaX: 30, deltaY: 30, ctrlKey: false }, middle, bounds)).toBe(START);
    });

    test('panning stops where an edge of the picture reaches its side of the stage', () => {
        const view = wheeled({ scale: 4, x: 0, y: 0 }, { deltaX: -5000, deltaY: 5000, ctrlKey: false }, middle, bounds);

        // 400 × 4 = 1600 wide in an 800 stage leaves 400 either way; 300 × 4 = 1200 in 600 leaves 300.
        expect(view).toEqual({ scale: 4, x: 400, y: -300 });
    });
});

describe('zoomed', () => {
    test('stops at the largest scale', () => {
        expect(zoomed({ scale: 6, x: 0, y: 0 }, 4, middle, bounds).scale).toBe(MAX_SCALE);
    });
});

describe('stepped', () => {
    test('moves to a neighbor and stops at either end', () => {
        expect(stepped(0, 3, 1)).toBe(1);
        expect(stepped(2, 3, -1)).toBe(1);
        expect(stepped(2, 3, 1)).toBeNull();
        expect(stepped(0, 3, -1)).toBeNull();
    });
});
