import { createContext, useContext, type RefObject } from 'react';

interface PaletteRefs {
    /* For the popup to put the focus in when it opens: a control before it would take it otherwise. */
    input: RefObject<HTMLInputElement | null>;

    /* For the root to scroll back to the top when the app sets the query. */
    list: RefObject<HTMLDivElement | null>;

    highlight(row: Element): void;
    virtualScroll: RefObject<((index: number, reason: string) => void) | null>;
}

export const PaletteRefsContext = createContext<PaletteRefs | null>(null);

export function useCommandPaletteVirtualScroll(): PaletteRefs['virtualScroll'] | null {
    return useContext(PaletteRefsContext)?.virtualScroll ?? null;
}
