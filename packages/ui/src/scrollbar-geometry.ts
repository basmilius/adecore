/* A thumb never gets shorter than this, so a long list keeps one a pointer can grab. */
export const MIN_THUMB = 24;

/* A press on the track moves this share of the visible length, so a line of the old view stays in sight. */
const PAGE_SHARE = 0.9;

export interface ScrollMetrics {
    /* The length of the bar the thumb moves along, in pixels. */
    readonly track: number;

    /* The visible length of the scroller (`clientHeight` or `clientWidth`). */
    readonly view: number;

    /* The full length of what scrolls (`scrollHeight` or `scrollWidth`). */
    readonly content: number;
}

export interface Thumb {
    readonly size: number;
    readonly offset: number;
}

/* Whether an axis has anything to scroll; a pixel of rounding is not worth a bar. */
export function overflows(view: number, content: number): boolean {
    return content - view > 1;
}

/* The thumb's length and its distance from the start of the track, in whole pixels. */
export function thumbOf({ track, view, content }: ScrollMetrics, position: number): Thumb {
    const range = content - view;

    if (range <= 0 || track <= 0) {
        return { size: Math.max(0, Math.round(track)), offset: 0 };
    }

    const size = Math.min(Math.round(track), Math.max(MIN_THUMB, Math.round((track * view) / content)));
    const progress = Math.min(1, Math.max(0, position / range));

    return { size, offset: Math.round((track - size) * progress) };
}

/* The scroll position after the thumb moved `moved` pixels from where a drag started. */
export function scrollAfterDrag(metrics: ScrollMetrics, start: number, moved: number): number {
    const range = metrics.content - metrics.view;
    const free = metrics.track - thumbOf(metrics, start).size;

    if (range <= 0 || free <= 0) {
        return start;
    }

    return Math.min(range, Math.max(0, start + (moved * range) / free));
}

/* How far a press on the track at `pointer` scrolls: a page toward the pointer, nothing on the thumb itself. */
export function pageToward(pointer: number, thumbStart: number, thumbEnd: number, view: number): number {
    const page = Math.round(view * PAGE_SHARE);

    if (pointer < thumbStart) {
        return -page;
    }

    if (pointer > thumbEnd) {
        return page;
    }

    return 0;
}
