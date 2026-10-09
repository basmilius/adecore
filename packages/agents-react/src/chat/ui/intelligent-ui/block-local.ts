import { useState } from 'react';
import type { UiRenderContext } from './render-context';

// Which tab or section a person opened, so a block the thread unmounts while scrolling comes back as they left it.
const remembered = new Map<string, unknown>();

/* State of one node that lasts as long as the page, such as a fold; local input state belongs to the runtime instead. */
export function useBlockLocal<Value>(context: UiRenderContext, nodeId: string, initial: () => Value): [Value, (next: Value) => void] {
    const key = `${context.scopeId}\n${context.chatId}\n${context.itemId}\n${context.blockId}\n${nodeId}`;
    const [value, setValue] = useState<Value>(() => (remembered.has(key) ? (remembered.get(key) as Value) : initial()));
    const set = (next: Value): void => {
        remembered.set(key, next);
        setValue(next);
    };
    return [value, set];
}
