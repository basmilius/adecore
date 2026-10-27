import type { EditorFont } from './metrics.ts';
import type { EditorZoom } from './types.ts';

/* Nothing a person reads is smaller. */
export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 90;
/* A trackpad or a pinch sends the wheel in small steps; this many pixels of them are one step of the size. */
const PIXELS_PER_STEP = 20;

export interface FontSizeRange {
    readonly min: number;
    readonly max: number;
}

export function fontSizeRange(zoom: EditorZoom | undefined): FontSizeRange {
    const min = Math.max(MIN_FONT_SIZE, Math.round(zoom?.min ?? MIN_FONT_SIZE));

    return { min, max: Math.max(min, Math.round(zoom?.max ?? MAX_FONT_SIZE)) };
}

/* In whole pixels inside the range. */
export function clampFontSize(size: number, range: FontSizeRange): number {
    return Math.min(range.max, Math.max(range.min, Math.round(size)));
}

/* The face at another size, with the line as much taller as the page's line is to its text, in whole pixels. */
export function zoomedFont(base: EditorFont, size: number): EditorFont {
    return { family: base.family, size, lineHeight: Math.round((size * base.lineHeight) / base.size) };
}

/* Turns the wheel with the zoom modifier, or a pinch, into steps of one pixel: up and apart make the text larger. */
export class WheelZoom {
    private pending = 0;

    /* -1, 0 or 1. A mouse notch is one step however far the platform says it went. */
    step(event: { deltaY: number; deltaMode: number }): number {
        if (event.deltaY === 0) {
            return 0;
        }

        if (event.deltaMode !== 0 || Math.abs(event.deltaY) >= PIXELS_PER_STEP) {
            this.pending = 0;

            return event.deltaY < 0 ? 1 : -1;
        }

        if (Math.sign(this.pending) !== 0 && Math.sign(this.pending) !== Math.sign(event.deltaY)) {
            this.pending = 0;
        }

        this.pending += event.deltaY;

        if (Math.abs(this.pending) < PIXELS_PER_STEP) {
            return 0;
        }

        const direction = this.pending < 0 ? 1 : -1;
        this.pending = 0;

        return direction;
    }
}
