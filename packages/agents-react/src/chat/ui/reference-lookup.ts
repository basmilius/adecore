import { createContext } from 'react';
import type { Referable } from '../chat-references';

export interface ReferenceLookup {
    items: readonly Referable[];
    /* Null where the host opens nothing. */
    open: ((id: string) => void) | null;
}

/* What the views and nodes of a message stand for now, handed down by the row that draws it. */
export const ReferenceLookupContext = createContext<ReferenceLookup>({ items: [], open: null });
