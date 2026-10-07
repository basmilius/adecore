/* The measures of the grid, in whole pixels. Row and header heights are steps of the 4px spacing scale. */
export const ROW_HEIGHT = 28;
export const HEADER_HEIGHT = 32;
export const MIN_COLUMN_WIDTH = 64;
export const MAX_COLUMN_WIDTH = 320;
/* How far a drag may widen a column; the estimate stops at `MAX_COLUMN_WIDTH`, a person may go further. */
export const MAX_RESIZED_WIDTH = 1200;
/* How wide fitting a column to its content may make it. */
export const MAX_FIT_WIDTH = 640;
/* The window of drawn rows moves in blocks of this many rows, so a scroll within a block draws nothing. */
export const ROW_BLOCK = 16;
/* Two presses on a resize handle this close are a double click. */
export const DOUBLE_CLICK_MS = 350;
/* What a viewport is taken to be until it is measured, so a first paint already holds rows. */
export const FALLBACK_VIEWPORT_HEIGHT = 600;

/* A glyph of the 13px mono face is 7.8px wide; a whole pixel on the safe side. */
const CHARACTER_WIDTH = 8;
const CELL_PADDING = 24;
const KEY_ICON_ROOM = 18;
const GUTTER_MIN_WIDTH = 40;
const SAMPLE_ROWS = 50;
/* The arrow and the position number a sorted header carries after its name. */
const SORT_ROOM = 24;

export interface VisibleRange {
    /* Index of the first row to draw. */
    readonly start: number;
    /* One past the last row to draw. */
    readonly end: number;
}

/* The block the top of the viewport is in, for a viewport `top` pixels into the rows. */
export const scrollBlock = (top: number): number => Math.floor(Math.max(0, top) / (ROW_BLOCK * ROW_HEIGHT));

/*
 * The rows to draw while the top of a viewport `height` pixels tall is in `block`: those in view and a
 * viewport more on each side, rounded out to whole blocks. A fast scroll finds its next rows drawn, and
 * the window moves, and the grid draws, once per block instead of once per row.
 */
export const drawnRange = (block: number, height: number, count: number): VisibleRange => {
    if (count <= 0 || height <= 0) {
        return { start: 0, end: 0 };
    }
    const page = Math.ceil(height / ROW_HEIGHT);
    const top = Math.max(0, block) * ROW_BLOCK;
    const start = Math.max(0, Math.floor((top - page) / ROW_BLOCK) * ROW_BLOCK);
    const end = Math.min(count, Math.ceil((top + ROW_BLOCK + 2 * page) / ROW_BLOCK) * ROW_BLOCK);
    return { start: Math.min(start, end), end };
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
    const named = header.length * CHARACTER_WIDTH + (keyed ? KEY_ICON_ROOM : 0) + SORT_ROOM;
    return clampColumnWidth(Math.max(body * CHARACTER_WIDTH, named) + CELL_PADDING);
};

/* Wide enough for the header and every text of the column, up to `MAX_FIT_WIDTH`. */
export const fitColumnWidth = (header: string, texts: readonly string[], keyed: boolean): number => {
    const body = texts.reduce((longest, text) => Math.max(longest, text.length), 0) * CHARACTER_WIDTH;
    const named = header.length * CHARACTER_WIDTH + (keyed ? KEY_ICON_ROOM : 0) + SORT_ROOM;
    return Math.max(MIN_COLUMN_WIDTH, Math.min(Math.ceil(Math.max(body, named) + CELL_PADDING), MAX_FIT_WIDTH));
};

export const isDoubleClick = (previous: number | null, now: number): boolean => previous !== null && now - previous <= DOUBLE_CLICK_MS;

/*
 * The estimated widths of a new page, never narrower than they were. A page with longer content widens
 * a column; a page with shorter content leaves it, so a sort does not make columns jump.
 */
export const growWidths = (previous: readonly number[], next: readonly number[]): number[] => next.map((width, index) => Math.max(width, previous[index] ?? 0));
