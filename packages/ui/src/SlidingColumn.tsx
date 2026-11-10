import clsx from 'clsx';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref, type RefObject } from 'react';
import { ColumnResizeHandle } from './ColumnResizeHandle.tsx';
import { mergeRefs } from './merge-refs.ts';
import { useColumnResize } from './useColumnResize.ts';

// How long the open and close motion takes; the same number as `.sliding-column` in `theme.css`.
const TRANSITION_MS = 200;

export interface SlidingColumnProps {
    open: boolean;

    /* The window edge the column stands against; the gap, the line and the resize handle are on the other side. */
    side?: 'left' | 'right';

    /* Already clamped by the caller, which knows what has to stay beside it (`clampColumnSize`). */
    width: number;

    /* Space between the surface and what is beside it, in pixels. Replaces the border and carries the resize handle. */
    gap?: number;

    /* The line beside the surface without a gap; off beside something that draws an edge of its own over that pixel, such as a workspace's sheet. */
    edge?: boolean;

    bounds: { min: number; max(): number };
    onWidthChange(width: number): void;

    /* For a column whose place is restored as the page loads; only what a person does afterwards should animate. */
    instant?: boolean;

    /* For a panel with shortcuts of its own. Focusable by script alone, so opening something in it hands it the keys without a click. */
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
 * The contents sit in an inner column of the stored width, so they do not reflow while the outer one
 * moves, and stay mounted until the slide is over, so a close plays out.
 */
export function SlidingColumn({
    open,
    side = 'right',
    width,
    gap = 0,
    edge = true,
    bounds,
    onWidthChange,
    instant = false,
    body,
    className,
    ref,
    children
}: SlidingColumnProps) {
    /* Closed and done animating. */
    const [settled, setSettled] = useState(!open);

    /* A width that lands without a transition fires no `transitionend`. */
    if (instant && settled !== !open) {
        setSettled(!open);
    }

    const present = open || !settled;
    const column = useRef<HTMLElement>(null);
    const spacing = Math.max(0, Math.round(gap));
    const left = side === 'left';

    const { startResize } = useColumnResize(column, {
        min: bounds.min + spacing,
        max: () => bounds.max() + spacing,
        size: width + spacing,
        from: side,
        onSize: (next) => onWidthChange(next - spacing)
    });

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
            data-gap={spacing > 0 ? '' : undefined}
            data-side={side}
            className={clsx('sliding-column flex h-full shrink-0 overflow-hidden', left ? 'justify-start' : 'justify-end', className)}
            style={{ width: open ? width + spacing : 0 }}
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
                    className={clsx(
                        'relative flex h-full shrink-0 flex-col bg-surface outline-none',
                        // Without its line the pixel stays, under the edge beside it, so the contents keep their place.
                        spacing === 0 && clsx(left ? 'border-r' : 'border-l', edge ? 'border-border' : 'border-transparent')
                    )}
                    style={{ width, ...(left ? { marginRight: spacing } : { marginLeft: spacing }) }}
                    onKeyDown={body?.onKeyDown}
                >
                    {open && (
                        <ColumnResizeHandle
                            from={side}
                            className="sliding-column-resize"
                            style={spacing > 0 ? { [left ? 'right' : 'left']: -spacing, width: spacing } : undefined}
                            onPointerDown={startResize}
                        />
                    )}
                    {children}
                </div>
            )}
        </aside>
    );
}
