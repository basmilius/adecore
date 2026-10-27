export const MIN_SCALE = 1;
export const MAX_SCALE = 8;
export const BUTTON_STEP = 1.5;

// A trackpad pinch arrives as small ctrl-wheel deltas; a mouse notch with Ctrl is clamped so it does not jump past the detail.
const PINCH_SPEED = 0.01;
const PINCH_LIMIT = 50;

export interface View {
    readonly scale: number;
    readonly x: number;
    readonly y: number;
}

export const START: View = { scale: 1, x: 0, y: 0 };

export interface Size {
    readonly width: number;
    readonly height: number;
}

/* The picture at a scale of 1 and the stage it is centered in, both in layout pixels. */
export interface Bounds {
    readonly image: Size;
    readonly frame: Size;
}

export interface Point {
    readonly x: number;
    readonly y: number;
}

export interface Wheel {
    readonly deltaX: number;
    readonly deltaY: number;
    readonly ctrlKey: boolean;
}

/* Keeps an edge of the picture from leaving its side of the stage, so a flick of two fingers never loses it. */
export function clamped(view: View, bounds: Bounds): View {
    const maxX = Math.max(0, (bounds.image.width * view.scale - bounds.frame.width) / 2);
    const maxY = Math.max(0, (bounds.image.height * view.scale - bounds.frame.height) / 2);

    return { scale: view.scale, x: Math.min(maxX, Math.max(-maxX, view.x)), y: Math.min(maxY, Math.max(-maxY, view.y)) };
}

/*
 * Zooms around a point, which is what makes a pinch over a detail feel like a magnifier instead of
 * a slider. The pixel under the fingers stays where it is while everything else moves away from it.
 * `x` and `y` are offsets from the middle of the stage, so a scale of 1 is always centered.
 */
export function zoomed(view: View, factor: number, point: Point, bounds: Bounds): View {
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));

    if (scale === MIN_SCALE) {
        return START;
    }

    const ratio = scale / view.scale;

    return clamped({ scale, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio }, bounds);
}

export function panned(view: View, deltaX: number, deltaY: number, bounds: Bounds): View {
    if (view.scale <= MIN_SCALE) {
        return view;
    }

    return clamped({ scale: view.scale, x: view.x + deltaX, y: view.y + deltaY }, bounds);
}

/* A pinch zooms (Chromium reports it as a wheel with Ctrl held) and two fingers pan the zoomed picture. */
export function wheeled(view: View, wheel: Wheel, point: Point, bounds: Bounds): View {
    if (wheel.ctrlKey) {
        const delta = Math.min(PINCH_LIMIT, Math.max(-PINCH_LIMIT, wheel.deltaY));

        return zoomed(view, Math.exp(-delta * PINCH_SPEED), point, bounds);
    }

    return panned(view, -wheel.deltaX, -wheel.deltaY, bounds);
}

/* The image a step away, or null at either end: the row does not wrap around. */
export function stepped(index: number, count: number, step: -1 | 1): number | null {
    const next = index + step;

    return next < 0 || next >= count ? null : next;
}
