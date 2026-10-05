export function createHolder<T>() {
    let value: T | null = null;
    const listeners = new Set<() => void>();
    return {
        get: () => value,
        set: (next: T | null) => {
            value = next;
            for (const listener of listeners) {
                listener();
            }
        },
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        }
    };
}
