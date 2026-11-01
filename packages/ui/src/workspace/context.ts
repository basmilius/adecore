import { createContext } from 'react';
import type { SplitEdges } from './geometry.ts';

export type WorkspaceLayout = 'standard' | 'roomy';

export const WorkspaceContext = createContext<{ layout: WorkspaceLayout; edges: SplitEdges }>({
    layout: 'standard',
    edges: { top: true, right: true, bottom: true, left: true }
});

/* The element of the top row a lone pane's bar goes into, which the row registers and every pane of the workspace reads. */
export const TopRowSlotContext = createContext<{ slot: HTMLElement | null; register(element: HTMLElement | null): void }>({
    slot: null,
    register: () => undefined
});
