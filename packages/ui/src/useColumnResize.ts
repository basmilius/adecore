import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';

/* Which edge the column hangs from, and with it the axis the drag runs along. A column pinned to
   the window's right edge grows as the pointer moves left; one that starts at its own left edge
   grows as it moves right, and the same holds for a row between `top` and `bottom`. */
export type ColumnEdge = 'left' | 'right' | 'top' | 'bottom';

export interface ColumnResizeOptions {
    /* What the column is wide, or the row is tall, right now, in whole pixels. */
    size: number;
    min: number;
    from: ColumnEdge;
    /* Read at drag time, so a window resize between two drags is taken into account. */
    max?(): number;
    /* Where the dragged size goes; called on every move, so the column follows the pointer. */
    onSize(size: number): void;
}

export interface ColumnResize {
    startResize(event: ReactPointerEvent<HTMLElement>): void;
}

export const clampColumnSize = (options: Pick<ColumnResizeOptions, 'min' | 'max'>, size: number): number => {
    const max = Math.max(options.min, options.max?.() ?? Number.MAX_SAFE_INTEGER);
    return Math.max(options.min, Math.min(Math.round(size), max));
};

/* Where the pointer sits on the axis this edge belongs to. */
const along = (from: ColumnEdge, event: { clientX: number; clientY: number }): number => (from === 'left' || from === 'right' ? event.clientX : event.clientY);

/*
 * One resizable column or row: a handle that drags the size its owner keeps. The handle takes the
 * pointer capture, so the drag survives leaving the few pixels it is wide, and `[data-resizing]` on
 * the column turns off any transition on that size for as long as it lasts.
 */
export const useColumnResize = (ref: RefObject<HTMLElement | null>, options: ColumnResizeOptions): ColumnResize => {
    const startResize = (event: ReactPointerEvent<HTMLElement>): void => {
        event.preventDefault();
        const handle = event.currentTarget;
        const column = ref.current;
        const rect = column?.getBoundingClientRect();
        const size = (options.from === 'left' || options.from === 'right' ? rect?.width : rect?.height) ?? options.size;
        const start = along(options.from, event);
        /* The far edge grows as the pointer comes towards it; the near edge grows as it goes away. */
        const growsTowardsAnchor = options.from === 'right' || options.from === 'bottom';
        column?.setAttribute('data-resizing', 'true');
        const onMove = (move: PointerEvent): void => {
            const delta = along(options.from, move) - start;
            options.onSize(clampColumnSize(options, size + (growsTowardsAnchor ? -delta : delta)));
        };
        const onUp = (): void => {
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onUp);
            handle.removeEventListener('pointercancel', onUp);
            handle.removeEventListener('lostpointercapture', onUp);
            if (handle.hasPointerCapture(event.pointerId)) {
                handle.releasePointerCapture(event.pointerId);
            }
            column?.removeAttribute('data-resizing');
        };
        handle.setPointerCapture(event.pointerId);
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
        handle.addEventListener('lostpointercapture', onUp);
    };

    return { startResize };
};
