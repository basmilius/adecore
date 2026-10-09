import { create } from 'zustand';
import type { UiReplyTarget } from './logic/timeline-target';

/* The row of a thread a jump landed on: it lights up once, and a card of changes opens when the jump asked for it. */
export interface TimelineFlash {
    /* The scope's key of the chat, so two chats showing the same row id never light up together. */
    key: string;
    rowId: string;
    opens: boolean;
    block?: Pick<UiReplyTarget, 'blockId' | 'revision'>;
    /* A second jump to the same row counts. */
    nonce: number;
}

interface TimelineFlashStore {
    target: TimelineFlash | null;
    flash(key: string, rowId: string, opens: boolean, block?: TimelineFlash['block']): void;
}

/* A little longer than the animation of `.chat-flash`, so a row that scrolls into view again later is neither lit nor opened a second time. */
const FLASH_MS = 2000;

export const useTimelineFlash = create<TimelineFlashStore>((set, get) => ({
    target: null,
    flash(key, rowId, opens, block) {
        const nonce = (get().target?.nonce ?? 0) + 1;
        set({ target: { key, rowId, opens, nonce, ...(block ? { block } : {}) } });
        const timer = setTimeout(() => {
            if (get().target?.nonce === nonce) {
                set({ target: null });
            }
        }, FLASH_MS);
        (timer as { unref?: () => void }).unref?.();
    }
}));
