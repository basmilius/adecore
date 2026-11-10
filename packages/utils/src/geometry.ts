export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export function centerOf(rect: Rect): Point {
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/* A point on the whole pixel, for a layout that lines its boxes and its lines up on a pixel grid. */
export function roundPoint(point: Point): Point {
    return { x: Math.round(point.x), y: Math.round(point.y) };
}

export function rotatePoint(point: Point, around: Point, angle: number): Point {
    if (angle === 0) {
        return point;
    }

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point.x - around.x;
    const dy = point.y - around.y;

    return { x: around.x + dx * cos - dy * sin, y: around.y + dx * sin + dy * cos };
}

export function unionOf(rects: readonly Rect[]): Rect | null {
    if (rects.length === 0) {
        return null;
    }

    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    for (const rect of rects) {
        left = Math.min(left, rect.x, rect.x + rect.w);
        top = Math.min(top, rect.y, rect.y + rect.h);
        right = Math.max(right, rect.x, rect.x + rect.w);
        bottom = Math.max(bottom, rect.y, rect.y + rect.h);
    }

    return { x: left, y: top, w: right - left, h: bottom - top };
}

export function intersects(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function rectFromPoints(from: Point, to: Point): Rect {
    return {
        x: Math.min(from.x, to.x),
        y: Math.min(from.y, to.y),
        w: Math.abs(to.x - from.x),
        h: Math.abs(to.y - from.y)
    };
}
