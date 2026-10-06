import { create } from 'zustand';

/*
 * The one visual in the window that has its large view or the question before its removal up, by the
 * scope's key of its chat. The thread draws both rather than the row, since the thread only keeps the
 * rows in view and a row that scrolls out would take an open dialog with it.
 */
interface VisualDialog {
    chatKey: string | null;
    visualId: string | null;
    kind: 'expand' | 'remove' | null;
    open(chatKey: string, visualId: string, kind: 'expand' | 'remove'): void;
    close(): void;
}

export const useVisualDialog = create<VisualDialog>((set) => ({
    chatKey: null,
    visualId: null,
    kind: null,
    open: (chatKey, visualId, kind) => set({ chatKey, visualId, kind }),
    close: () => set({ chatKey: null, visualId: null, kind: null })
}));
