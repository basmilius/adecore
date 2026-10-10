import { useEffect, useState, type ReactElement } from 'react';
import { clampShift, maxShift, SHIFT_PROPERTY, shiftNeed, shiftThumb, sidewaysDelta } from './shift.ts';

const HIDE_AFTER = 900;

const NEAR_BOTTOM = 16;

/* Where a tree draws its rows, and how far a row reaches past the edge it may use. */
export interface TreeShiftSource {
    /* The node whose changes add, remove or rename rows; null while the tree has not drawn it yet. */
    root(frame: HTMLElement): ParentNode | null;
    rows(root: ParentNode): readonly HTMLElement[];
    /* How many pixels of the row lie past its edge at no shift; null for a row that is not laid out. */
    need(row: HTMLElement, shift: number, gap: number, range: Range): number | null;
}

/*
 * Rows that are wider than the tree slide sideways together, by a shift every row reads from the
 * frame's `--adecore-tree-shift`, with a thin bar that shows while a person scrolls or nears it. A
 * shift instead of a scroll keeps every row's background and the vertical scroll where they are.
 */
export function useTreeShift(source: TreeShiftSource, resetKey?: string): { attach(node: HTMLElement | null): void; bar: ReactElement } {
    const [frame, setFrame] = useState<HTMLElement | null>(null);
    const [track, setTrack] = useState<HTMLDivElement | null>(null);
    const [thumb, setThumb] = useState<HTMLDivElement | null>(null);

    useEffect(() => {
        if (frame === null || track === null || thumb === null) {
            return;
        }
        const range = document.createRange();
        let root: ParentNode | null = null;
        let exact = 0;
        let drawn = 0;
        let max = 0;
        let pending = 0;
        let hideTimer = 0;
        let scrolling = false;
        let near = false;

        const draw = (): void => {
            const shift = Math.round(exact);
            if (shift !== drawn) {
                drawn = shift;
                frame.style.setProperty(SHIFT_PROPERTY, `${shift}px`);
            }
            const { left, width } = shiftThumb(shift, max, track.clientWidth, frame.clientWidth);
            thumb.style.left = `${left}px`;
            thumb.style.width = `${width}px`;
            track.toggleAttribute('data-visible', max > 0 && (scrolling || near));
        };

        const measure = (): void => {
            pending = 0;
            if (root === null) {
                root = source.root(frame);
                if (root === null) {
                    return;
                }
                rows.observe(root, { childList: true, subtree: true, characterData: true });
            }
            const drawnRows = source.rows(root);
            const gap = drawnRows.length === 0 ? 0 : Number.parseFloat(getComputedStyle(drawnRows[0]!).columnGap) || 0;
            max = maxShift(drawnRows.map((row) => source.need(row, drawn, gap, range)).filter((need) => need !== null));
            exact = clampShift(exact, max);
            draw();
        };

        const schedule = (): void => {
            if (pending === 0) {
                pending = requestAnimationFrame(measure);
            }
        };

        const rows = new MutationObserver(schedule);
        const mounts = new MutationObserver(schedule);
        mounts.observe(frame, { childList: true, subtree: true });
        const sizes = new ResizeObserver(schedule);
        sizes.observe(frame);

        const onWheel = (event: WheelEvent): void => {
            const delta = sidewaysDelta(event, frame.clientWidth);
            if (delta === 0 || max === 0) {
                return;
            }
            scrolling = true;
            window.clearTimeout(hideTimer);
            hideTimer = window.setTimeout(() => {
                scrolling = false;
                draw();
            }, HIDE_AFTER);
            const next = clampShift(exact + delta, max);
            if (next !== exact) {
                event.preventDefault();
                exact = next;
            }
            draw();
        };

        const onPointerMove = (event: PointerEvent): void => {
            const bottom = track.getBoundingClientRect().bottom;
            const isNear = event.clientY >= bottom - NEAR_BOTTOM;
            if (isNear !== near) {
                near = isNear;
                draw();
            }
        };

        const onPointerLeave = (): void => {
            if (near) {
                near = false;
                draw();
            }
        };

        frame.addEventListener('wheel', onWheel, { passive: false });
        frame.addEventListener('pointermove', onPointerMove);
        frame.addEventListener('pointerleave', onPointerLeave);
        schedule();

        return () => {
            frame.removeEventListener('wheel', onWheel);
            frame.removeEventListener('pointermove', onPointerMove);
            frame.removeEventListener('pointerleave', onPointerLeave);
            rows.disconnect();
            mounts.disconnect();
            sizes.disconnect();
            cancelAnimationFrame(pending);
            window.clearTimeout(hideTimer);
            frame.style.removeProperty(SHIFT_PROPERTY);
            track.removeAttribute('data-visible');
        };
    }, [frame, track, thumb, source, resetKey]);

    const bar = (
        <div aria-hidden className="adecore-tree-shift">
            <div ref={setTrack} className="adecore-tree-shift-track">
                <div ref={setThumb} className="adecore-tree-shift-thumb" />
            </div>
        </div>
    );

    return { attach: setFrame, bar };
}

/* The rows of `Tree.Root`: everything a row holds slides, so a row reaches as far as its last part. */
export const TREE_ROWS: TreeShiftSource = {
    root: (frame) => frame,
    rows: (root) => [...root.querySelectorAll<HTMLElement>('.adecore-tree-row')],
    need: (row, shift) => {
        const box = row.getBoundingClientRect();
        if (box.width === 0) {
            return null;
        }
        const parts = [...row.children].filter((child) => !child.classList.contains('adecore-tree-guide'));
        if (parts.length === 0) {
            return null;
        }
        const reach = Math.max(...parts.map((part) => part.getBoundingClientRect().right));
        const limit = box.right - (Number.parseFloat(getComputedStyle(row).paddingInlineEnd) || 0);
        return shiftNeed(reach, limit, shift);
    }
};
