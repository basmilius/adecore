import type { ChatAssistantItem } from '@adecore/agent-contracts';
import { uiFallbackText } from '@adecore/intelligent-ui/text';

/*
 * An assistant's words as another agent or a person outside the thread reads them: each UI block becomes
 * its text fallback, with the first query values when they were frozen for the block as stored. It works
 * from the stored block ranges, so it holds whatever fence language the host compiled.
 */
export function readableAssistantText(item: Pick<ChatAssistantItem, 'text' | 'ui' | 'uiQueries'>): string {
    if (!item.ui?.length) {
        return item.text;
    }
    const blocks = item.ui.map((block) => {
        const frozen = item.uiQueries?.blocks[block.id];
        return frozen && frozen.revision === block.revision ? { ...block, fallback: frozen.fallback } : block;
    });
    return uiFallbackText(item.text, blocks);
}
