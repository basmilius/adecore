import { describe, expect, test } from 'bun:test';
import { centerOf, intersects, rectFromPoints, rotatePoint, roundPoint, unionOf } from './geometry.ts';

describe('geometry', () => {
    test('a drag in any direction makes a box with positive sides', () => {
        expect(rectFromPoints({ x: 100, y: 80 }, { x: 20, y: 20 })).toEqual({ x: 20, y: 20, w: 80, h: 60 });
    });

    test('a point turns around the center it is given', () => {
        const turned = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);

        expect(turned.x).toBeCloseTo(0, 5);
        expect(turned.y).toBeCloseTo(10, 5);
        expect(rotatePoint({ x: 3, y: 4 }, { x: 0, y: 0 }, 0)).toEqual({ x: 3, y: 4 });
    });

    test('the union holds every box, and nothing has none', () => {
        expect(
            unionOf([
                { x: 0, y: 0, w: 100, h: 60 },
                { x: 200, y: 100, w: 100, h: 60 }
            ])
        ).toEqual({ x: 0, y: 0, w: 300, h: 160 });
        expect(unionOf([])).toBeNull();
    });

    test('boxes that only touch do not overlap', () => {
        const box = { x: 0, y: 0, w: 10, h: 10 };

        expect(intersects(box, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
        expect(intersects(box, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    });

    test('the middle of a box and a point on the whole unit', () => {
        expect(centerOf({ x: 10, y: 20, w: 30, h: 40 })).toEqual({ x: 25, y: 40 });
        expect(roundPoint({ x: 1.4, y: 2.5 })).toEqual({ x: 1, y: 3 });
    });
});
