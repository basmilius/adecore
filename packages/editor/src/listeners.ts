export type Listener = () => void;

export function subscribe<T>(listeners: Set<T>, listener: T): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/* Over a copy, so a listener that unsubscribes itself does not skip the next one. */
export function emit<Args extends unknown[]>(listeners: Set<(...args: Args) => void>, ...args: Args): void {
    for (const listener of [...listeners]) {
        listener(...args);
    }
}
