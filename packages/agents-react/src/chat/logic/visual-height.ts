import { VISUAL_LIMITS, visualFrameHeight, type ChatVisual } from '@adecore/agent-contracts/visual';

/* A frame before anything measured its page: room for a chart, never taller than the page may grow. */
const DEFAULT_HEIGHT_PX = 240;
/* Plenty for the visuals of a long session; the oldest goes first. */
const REMEMBERED_HEIGHTS = 500;

/*
 * The heights frames reported, by visual and width. The thread draws only the rows in view, so a row
 * that scrolls back in mounts a new frame, which starts at the height its page had there before.
 */
const remembered = new Map<string, number>();

function keyOf(visualId: string, width: number): string {
    return `${visualId}@${Math.round(width)}`;
}

/* A height a page reported, held to the visual's own maximum and the limits, in whole pixels. */
export function clampVisualHeight(visual: Pick<ChatVisual, 'maxHeight'>, height: number): number {
    return Math.min(Math.max(Math.ceil(Math.min(height, visual.maxHeight)), VISUAL_LIMITS.minHeight), VISUAL_LIMITS.maxHeight);
}

/*
 * The height a frame `width` CSS pixels wide starts at: what the page reported in a frame that wide
 * before, else what the host measured, else a modest default.
 */
export function initialVisualHeight(visual: Pick<ChatVisual, 'id' | 'maxHeight' | 'heights'>, width: number): number {
    return remembered.get(keyOf(visual.id, width)) ?? visualFrameHeight(visual, width) ?? clampVisualHeight(visual, DEFAULT_HEIGHT_PX);
}

export function rememberVisualHeight(visualId: string, width: number, height: number): void {
    const key = keyOf(visualId, width);
    remembered.delete(key);
    remembered.set(key, height);
    if (remembered.size > REMEMBERED_HEIGHTS) {
        remembered.delete(remembered.keys().next().value!);
    }
}
