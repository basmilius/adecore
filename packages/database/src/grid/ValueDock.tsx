import { useRef, useState, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { ColumnResizeHandle, useColumnResize } from '@adecore/ui';
import { assignRef } from '../assign-ref.ts';

export const VALUE_PANEL_WIDTH = 320;
export const VALUE_PANEL_MIN_WIDTH = 240;

export interface ValueDockProps {
    open: boolean;
    /* Drawn on the right of the children while the dock is open. */
    panel: ReactNode;
    /* The grid and whatever shares its column. */
    children: ReactNode;
    /* The width of the panel, when the owner keeps it; without it the dock keeps it itself. */
    width?: number;
    onWidthChange?(width: number): void;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* A grid with a panel along its right edge that a person can widen by its left edge. */
export function ValueDock({ open, panel, children, width: given, onWidthChange, className, ref }: ValueDockProps) {
    const root = useRef<HTMLDivElement | null>(null);
    const dock = useRef<HTMLDivElement>(null);
    const [own, setOwn] = useState(VALUE_PANEL_WIDTH);
    const width = given ?? own;
    const { startResize } = useColumnResize(dock, {
        size: width,
        min: VALUE_PANEL_MIN_WIDTH,
        from: 'right',
        max: () => (root.current?.clientWidth ?? 960) - VALUE_PANEL_MIN_WIDTH,
        onSize: (next) => {
            if (given === undefined) {
                setOwn(next);
            }
            onWidthChange?.(next);
        }
    });

    return (
        <div
            ref={(node) => {
                root.current = node;
                assignRef(ref, node);
            }}
            className={clsx('flex min-h-0 min-w-0 flex-1', className)}
        >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
            {open && (
                <div ref={dock} className="relative flex min-h-0 shrink-0 border-l border-border" style={{ width }}>
                    <ColumnResizeHandle from="right" onPointerDown={startResize} className="hover:bg-border-strong" />
                    {panel}
                </div>
            )}
        </div>
    );
}
