import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';

/* The edge the column hangs from, and with it the axis the drag runs along. A column pinned to the right edge grows as the pointer moves left. */
export type ColumnEdge = 'left' | 'right' | 'top' | 'bottom';

export interface ColumnResizeOptions {
    /* In whole pixels. */
    size: number;
    min: number;
    from: ColumnEdge;
    /* Read at drag time, so a window resize between two drags is taken into account. */
    max?(): number;
    /* Called on every move. */
    onSize(size: number): void;
}

const DRAG_ENDS = ['pointerup', 'pointercancel', 'lostpointercapture'] as const;

export interface ColumnResize {
    startResize(event: ReactPointerEvent<HTMLElement>): void;
}

export const clampColumnSize = (options: Pick<ColumnResizeOptions, 'min' | 'max'>, size: number): number => {
    const max = Math.max(options.min, options.max?.() ?? Number.MAX_SAFE_INTEGER);
    return Math.max(options.min, Math.min(Math.round(size), max));
};

const along = (from: ColumnEdge, event: { clientX: number; clientY: number }): number => (from === 'left' || from === 'right' ? event.clientX : event.clientY);

/*
 * The handle takes the pointer capture, so the drag survives leaving the few pixels it is wide, and
 * `[data-resizing]` on the column turns off any transition on that size for as long as it lasts.
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
            for (const type of DRAG_ENDS) {
                handle.removeEventListener(type, onUp);
            }
            if (handle.hasPointerCapture(event.pointerId)) {
                handle.releasePointerCapture(event.pointerId);
            }
            column?.removeAttribute('data-resizing');
        };
        handle.setPointerCapture(event.pointerId);
        handle.addEventListener('pointermove', onMove);
        for (const type of DRAG_ENDS) {
            handle.addEventListener(type, onUp);
        }
    };

    return { startResize };
};
