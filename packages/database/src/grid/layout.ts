/* The measures of the grid, in whole pixels. Row and header heights are steps of the 4px spacing scale. */
export const ROW_HEIGHT = 28;
export const HEADER_HEIGHT = 32;
export const MIN_COLUMN_WIDTH = 64;
export const MAX_COLUMN_WIDTH = 320;
/* How far a drag may widen a column; the estimate stops at `MAX_COLUMN_WIDTH`, a person may go further. */
export const MAX_RESIZED_WIDTH = 1200;
export const OVERSCAN_ROWS = 6;
/* What a viewport is taken to be until it is measured, so a first paint already holds rows. */
export const FALLBACK_VIEWPORT_HEIGHT = 600;

/* A glyph of the 13px mono face is 7.8px wide; a whole pixel on the safe side. */
const CHARACTER_WIDTH = 8;
const CELL_PADDING = 24;
const KEY_ICON_ROOM = 18;
const GUTTER_MIN_WIDTH = 40;
const SAMPLE_ROWS = 50;

export interface VisibleRange {
    /* Index of the first row to draw. */
    readonly start: number;
    /* One past the last row to draw. */
    readonly end: number;
}

/* The rows that touch a viewport of `height` pixels starting `top` pixels into the rows, plus `overscan` rows on both sides. */
export const visibleRange = (top: number, height: number, rowHeight: number, count: number, overscan: number): VisibleRange => {
    if (count <= 0 || height <= 0) {
        return { start: 0, end: 0 };
    }
    const first = Math.floor(Math.max(0, top) / rowHeight);
    const last = Math.ceil(Math.max(0, top + height) / rowHeight);
    return { start: Math.max(0, Math.min(first, count) - overscan), end: Math.min(count, last + overscan) };
};

/*
 * Where to scroll so that an item at `start` that is `size` long is in view. `leading` is the part of
 * the viewport a sticky header or gutter covers. Returns `scroll` itself when the item is already visible.
 */
export const scrollToReveal = (start: number, size: number, scroll: number, viewport: number, leading: number): number => {
    if (start < scroll + leading) {
        return Math.max(0, start - leading);
    }
    if (start + size > scroll + viewport) {
        return Math.max(0, start + size - viewport);
    }
    return scroll;
};

/* The left edge of every column, counted from the first one. */
export const columnOffsets = (widths: readonly number[]): number[] => {
    let offset = 0;
    return widths.map((width) => {
        const left = offset;
        offset += width;
        return left;
    });
};

/* Wide enough for the largest row number, never narrower than `GUTTER_MIN_WIDTH`. */
export const gutterWidth = (rowCount: number): number => Math.max(GUTTER_MIN_WIDTH, String(Math.max(rowCount, 1)).length * CHARACTER_WIDTH + CELL_PADDING);

export const clampColumnWidth = (width: number): number => Math.max(MIN_COLUMN_WIDTH, Math.min(Math.ceil(width), MAX_COLUMN_WIDTH));

/* From the longest text among the header and the first rows. `keyed` makes room for the key icon in front of the name. */
export const estimateColumnWidth = (header: string, samples: readonly string[], keyed: boolean): number => {
    const body = samples.slice(0, SAMPLE_ROWS).reduce((longest, text) => Math.max(longest, text.length), 0);
    const named = header.length + (keyed ? KEY_ICON_ROOM / CHARACTER_WIDTH : 0);
    return clampColumnWidth(Math.max(body, named) * CHARACTER_WIDTH + CELL_PADDING);
};
