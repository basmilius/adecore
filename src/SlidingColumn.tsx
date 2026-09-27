import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref, type RefObject } from 'react';
import clsx from 'clsx';
import { ColumnResizeHandle } from './ColumnResizeHandle.tsx';
import { mergeRefs } from './merge-refs.ts';
import { useColumnResize } from './useColumnResize.ts';

// How long the open and close motion takes; the same number as `.sliding-column` in `theme.css`.
const TRANSITION_MS = 200;

export interface SlidingColumnProps {
    open: boolean;
    /* Already clamped by the caller, which knows what has to stay beside it (`clampColumnSize`). */
    width: number;
    bounds: { min: number; max(): number };
    onWidthChange(width: number): void;
    /*
     * The width lands without the motion, for a column whose place is being restored as the page
     * loads; only what a person does afterwards should animate.
     */
    instant?: boolean;
    /*
     * The column takes the keyboard itself, for a panel with shortcuts of its own. It is focusable
     * by script alone, so opening something in it hands it the keys without a click first.
     */
    body?: {
        ref: RefObject<HTMLDivElement | null>;
        onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void;
    };
    className?: string;
    /* The outer column, for bounds that measure what is beside it rather than the whole window. */
    ref?: Ref<HTMLElement>;
    children?: ReactNode;
}

/*
 * A panel that slides in and out along the right edge. The outer column is 0 wide and inert while
 * closed; the contents sit in an inner column of the stored width, so they do not reflow while it
 * moves, and they stay mounted until the slide is over, so a close plays out. The left edge is the
 * drag handle.
 */
export function SlidingColumn({ open, width, bounds, onWidthChange, instant = false, body, className, ref, children }: SlidingColumnProps) {
    /* Closed and done animating. Until then the contents stay mounted, so a close plays out. */
    const [settled, setSettled] = useState(!open);
    /* A width that lands without a transition fires no `transitionend`, so the motion it would have
       ended is over in the same commit that starts it. */
    if (instant && settled !== !open) {
        setSettled(!open);
    }
    const present = open || !settled;
    const column = useRef<HTMLElement>(null);
    const { startResize } = useColumnResize(column, { ...bounds, size: width, from: 'right', onSize: onWidthChange });

    useEffect(() => {
        if (open || settled) {
            return;
        }
        // Reduced motion and a hidden tab paint no width change, so no `transitionend` arrives.
        const timer = window.setTimeout(() => setSettled(true), TRANSITION_MS + 50);
        return () => {
            window.clearTimeout(timer);
        };
    }, [open, settled]);

    return (
        <aside
            ref={mergeRefs(column, ref)}
            inert={!open}
            data-instant={instant ? '' : undefined}
            className={clsx('sliding-column flex h-full shrink-0 justify-end overflow-hidden', className)}
            style={{ width: open ? width : 0 }}
            onTransitionEnd={(event) => {
                if (event.propertyName === 'width' && event.target === event.currentTarget) {
                    setSettled(!open);
                }
            }}
        >
            {present && (
                <div
                    ref={body?.ref}
                    tabIndex={body ? -1 : undefined}
                    className="relative flex h-full shrink-0 flex-col border-l border-border bg-surface outline-none"
                    style={{ width }}
                    onKeyDown={body?.onKeyDown}
                >
                    {open && <ColumnResizeHandle from="right" onPointerDown={startResize} />}
                    {children}
                </div>
            )}
        </aside>
    );
}
