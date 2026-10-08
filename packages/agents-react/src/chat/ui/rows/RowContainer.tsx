import type { ReactNode, Ref } from 'react';
import clsx from 'clsx';
import type { TimelineRow } from '../../logic/timeline';
import { rowPosition, rowRhythm } from './row-rhythm';

export interface RowContainerProps {
    row: TimelineRow;
    previous: TimelineRow | null;
    index: number;
    top: number;
    ref?: Ref<HTMLDivElement>;
    children: ReactNode;
}

export function RowContainer({ row, previous, index, top, ref, children }: RowContainerProps) {
    const wide = row.kind === 'visual' && row.visual.layout === 'wide';
    return (
        <div
            data-index={index}
            data-item-id={row.id}
            ref={ref}
            className={clsx(
                'absolute inset-x-0 top-0 mx-auto w-full',
                wide ? 'chat-wide-content' : 'chat-column-content',
                rowRhythm(row, previous),
                // Turn gaps belong inside the measurement used by the virtualizer.
                row.kind === 'user' && index > 0 && 'pt-(--chat-turn-gap)'
            )}
            style={rowPosition(row.kind, top)}
        >
            {children}
        </div>
    );
}
