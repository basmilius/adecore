import { createContext } from 'react';
import type { SplitEdges } from './geometry.ts';

export type WorkspaceLayout = 'standard' | 'roomy';
export const WorkspaceContext = createContext<{ layout: WorkspaceLayout; edges: SplitEdges }>({
    layout: 'standard',
    edges: { top: true, right: true, bottom: true, left: true }
});
