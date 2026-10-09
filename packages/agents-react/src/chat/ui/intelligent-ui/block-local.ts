import { useState } from 'react';
import type { UiRenderContext } from './render-context';

/* Values that last as long as the page, past `limit` forgetting the one used longest ago. */
export class UiPageMemory<Value> {
    private readonly entries = new Map<string, Value>();
    private readonly limit: number;

    constructor(limit: number) {
        this.limit = limit;
    }

    has(key: string): boolean {
        return this.entries.has(key);
    }

    /* Reading a value counts as using it. */
    get(key: string): Value | undefined {
        const value = this.entries.get(key);
        if (value !== undefined) {
            this.set(key, value);
        }
        return value;
    }

    set(key: string, value: Value): void {
        this.entries.delete(key);
        this.entries.set(key, value);
        if (this.entries.size > this.limit) {
            this.entries.delete(this.entries.keys().next().value!);
        }
    }

    get size(): number {
        return this.entries.size;
    }
}

// Which tab or section a person opened, so a block the thread unmounts while scrolling comes back as they left it.
const remembered = new UiPageMemory<unknown>(512);

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
