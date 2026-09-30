import type { PointerEvent as ReactPointerEvent, Ref } from 'react';
import clsx from 'clsx';
import type { ColumnEdge } from './useColumnResize.ts';

export interface ColumnResizeHandleProps {
    /* The edge the column hangs from, as handed to `useColumnResize`; the handle sits on the other one. */
    from: ColumnEdge;
    onPointerDown(event: ReactPointerEvent<HTMLElement>): void;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

const PLACEMENT: Record<ColumnEdge, string> = {
    left: 'inset-y-0 right-0 w-2 cursor-col-resize',
    right: 'inset-y-0 left-0 w-2 cursor-col-resize',
    top: 'inset-x-0 bottom-0 h-2 cursor-row-resize',
    bottom: 'inset-x-0 top-0 h-2 cursor-row-resize'
};

/* An invisible strip over the free edge of a column, so the column needs `relative` and draws its own border. */
export function ColumnResizeHandle({ from, onPointerDown, className, ref }: ColumnResizeHandleProps) {
    return <div ref={ref} className={clsx('absolute z-10', PLACEMENT[from], className)} onPointerDown={onPointerDown} />;
}
