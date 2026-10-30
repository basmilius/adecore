import type { HeatCell } from './heat.ts';

export interface HeatmapCursor {
    getSnapshot(): HeatCell | null;
    isActive(cell: HeatCell): boolean;
    set(cell: HeatCell | null): void;
    subscribe(listener: () => void): () => void;
    subscribeCell(cell: HeatCell, listener: () => void): () => void;
}

/* Only the old and new cell subscriptions need a cursor update. */
export function createHeatmapCursor(): HeatmapCursor {
    let current: HeatCell | null = null;
    const listeners = new Set<() => void>();
    const cells = new Map<string, Set<() => void>>();
    const keyOf = (cell: HeatCell): string => `${cell.row}:${cell.column}`;
    const isActive = (cell: HeatCell): boolean => current !== null && current.row === cell.row && current.column === cell.column;

    const emit = (subscribers: ReadonlySet<() => void> | undefined): void => {
        if (subscribers === undefined) {
            return;
        }

        for (const listener of [...subscribers]) {
            listener();
        }
    };

    return {
        getSnapshot: () => current,
        isActive,
        set(cell) {
            if (cell === null ? current === null : isActive(cell)) {
                return;
            }

            const previous = current;
            const next = cell === null ? null : { ...cell };
            current = next;

            if (previous !== null) {
                emit(cells.get(keyOf(previous)));
            }

            if (next !== null) {
                emit(cells.get(keyOf(next)));
            }

            emit(listeners);
        },
        subscribe(listener) {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        subscribeCell(cell, listener) {
            const key = keyOf(cell);
            let subscribers = cells.get(key);
            if (subscribers === undefined) {
                subscribers = new Set();
                cells.set(key, subscribers);
            }

            const subscribed = subscribers;
            subscribed.add(listener);

            return () => {
                subscribed.delete(listener);
                if (subscribed.size === 0 && cells.get(key) === subscribed) {
                    cells.delete(key);
                }
            };
        }
    };
}
