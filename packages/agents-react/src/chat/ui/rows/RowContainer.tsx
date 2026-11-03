import type { ReactNode, Ref } from 'react';
import clsx from 'clsx';
import { useChatHost } from '../../../host';
import type { TimelineRow } from '../../logic/timeline';
import { rowPosition, rowRhythm, saidToChat } from './row-rhythm';

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
    const hostSpeaks = useChatHost().saidBy !== undefined;

    return (
        <div
            data-index={index}
            data-item-id={row.id}
            ref={ref}
            className={clsx(
                'absolute inset-x-0 top-0 mx-auto w-full',
                wide ? 'chat-wide-content' : 'chat-column-content',
                rowRhythm(row, previous, hostSpeaks),
                // Turn gaps belong inside the measurement used by the virtualizer.
                saidToChat(row, hostSpeaks) && index > 0 && 'pt-(--chat-turn-gap)'
            )}
            style={rowPosition(row.kind, top)}
        >
            {children}
        </div>
    );
}
