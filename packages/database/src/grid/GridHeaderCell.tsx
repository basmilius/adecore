import { useRef } from 'react';
import { ColumnResizeHandle, Icon, Tooltip, useColumnResize } from '@adecore/ui';
import { KeyRound } from 'lucide-react';
import { MAX_RESIZED_WIDTH, MIN_COLUMN_WIDTH } from './layout.ts';
import type { GridColumn } from './types.ts';

export interface GridHeaderCellProps {
    column: GridColumn;
    /* Position among the columns of the grid, counted from zero. */
    index: number;
    width: number;
    onResize(index: number, width: number): void;
}

/* One column's head: its name, a key on a primary key column, and the strip that resizes it. */
export function GridHeaderCell({ column, index, width, onResize }: GridHeaderCellProps) {
    const cell = useRef<HTMLDivElement>(null);
    const { startResize } = useColumnResize(cell, {
        size: width,
        min: MIN_COLUMN_WIDTH,
        from: 'left',
        max: () => MAX_RESIZED_WIDTH,
        onSize: (size) => onResize(index, size)
    });

    return (
        <div
            ref={cell}
            role="columnheader"
            aria-colindex={index + 2}
            className="relative flex h-full shrink-0 items-center gap-1.5 overflow-hidden border-r border-border px-3 text-xs font-medium text-text-muted"
            style={{ width }}
        >
            {column.primaryKey === true && <Icon icon={KeyRound} size={12} className="shrink-0" />}
            <Tooltip label={column.type === '' ? column.name : `${column.name} (${column.type})`} side="bottom">
                <span className="min-w-0 truncate">{column.name}</span>
            </Tooltip>
            <ColumnResizeHandle from="left" onPointerDown={startResize} className="hover:bg-border-strong" />
        </div>
    );
}
