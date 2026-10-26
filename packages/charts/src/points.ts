export interface PlacedPoint {
    readonly index: number;
    readonly x: number;
    readonly y: number;
}

/* The point closest to (x, y) within `reach` pixels, so the pointer need not land on a mark exactly; -1 for none. */
export function nearestPoint(points: readonly PlacedPoint[], x: number, y: number, reach: number): number {
    let nearest = -1;
    let distance = reach;

    for (const point of points) {
        const away = Math.hypot(point.x - x, point.y - y);

        if (away <= distance) {
            distance = away;
            nearest = point.index;
        }
    }

    return nearest;
}

/*
 * Where a key moves the cursor among the points of their series, each a list of row indexes in the order of the data:
 * Left and Right along a series, Up and Down to the same place in the previous or the next series that has points,
 * Home and End to the ends of the series. `null` clears the cursor, `undefined` leaves the key to the page.
 */
export function movePoint(lines: readonly (readonly number[])[], current: number, key: string): number | null | undefined {
    const filled = lines.filter((line) => line.length > 0);

    if (filled.length === 0) {
        return undefined;
    }

    const line = filled.findIndex((indexes) => indexes.includes(current));

    if (line < 0) {
        if (key === 'Escape') {
            return undefined;
        }

        const arrows = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];

        if (!arrows.includes(key)) {
            return undefined;
        }

        return key === 'ArrowLeft' || key === 'ArrowUp' || key === 'End' ? filled.at(-1)!.at(-1)! : filled[0]![0]!;
    }

    const indexes = filled[line]!;
    const at = indexes.indexOf(current);

    switch (key) {
        case 'ArrowRight':
            return indexes[Math.min(indexes.length - 1, at + 1)];
        case 'ArrowLeft':
            return indexes[Math.max(0, at - 1)];
        case 'ArrowDown':
        case 'ArrowUp': {
            const next = filled[line + (key === 'ArrowDown' ? 1 : -1)];

            return next === undefined ? current : next[Math.min(at, next.length - 1)];
        }
        case 'Home':
            return indexes[0];
        case 'End':
            return indexes.at(-1);
        case 'Escape':
            return null;
        default:
            return undefined;
    }
}

/*
 * The points no other point beats on both axes: none is at least as good on x and on y, and better on one of them.
 * In order of x, which is the order a band runs through them. `lowerX` says a low x is the better one, as a cost is.
 */
export function frontierOf<Point extends { readonly x: number; readonly y: number }>(points: readonly Point[], lowerX = true, higherY = true): Point[] {
    const sign = { x: lowerX ? 1 : -1, y: higherY ? 1 : -1 };
    const sorted = [...points].sort((one, other) => sign.x * (one.x - other.x) || sign.y * (other.y - one.y));
    const kept: Point[] = [];
    let best = -Infinity;

    for (const point of sorted) {
        if (sign.y * point.y > best) {
            kept.push(point);
            best = sign.y * point.y;
        }
    }

    return kept.sort((one, other) => one.x - other.x);
}

/*
 * The centers of labels that stand in a column, as close to their wish as they can without two coming nearer than
 * `wanted`, and inside `top` to `bottom`. In the order they were given. Where they do not fit, the gap shrinks until they do.
 */
export function spreadLabels(wishes: readonly number[], wanted: number, top: number, bottom: number): number[] {
    const order = wishes.map((wish, index) => ({ wish, index })).sort((one, other) => one.wish - other.wish || one.index - other.index);
    const placed = order.map(({ wish }) => wish);
    const gap = placed.length > 1 ? Math.min(wanted, Math.max(0, bottom - top) / (placed.length - 1)) : wanted;

    for (let i = 0; i < placed.length; i++) {
        placed[i] = Math.max(top, placed[i]!, i === 0 ? top : placed[i - 1]! + gap);
    }

    for (let i = placed.length - 1; i >= 0; i--) {
        placed[i] = Math.min(placed[i]!, i === placed.length - 1 ? bottom : placed[i + 1]! - gap);
    }

    const result: number[] = [];

    order.forEach(({ index }, i) => {
        result[index] = placed[i]!;
    });

    return result;
}
