import { useContext } from 'react';
import { TopRowSlotContext } from './context.ts';

/** The slot of the `Workspace`'s top row, for `PaneBar`'s `container`, or null while there is none. */
export function useTopRowSlot(): HTMLElement | null {
    return useContext(TopRowSlotContext).slot;
}
