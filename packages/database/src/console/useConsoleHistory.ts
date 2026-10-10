import { useEffect, useState } from 'react';
import type { DatabaseStorage } from '../actions.ts';
import { useDatabaseStorage } from '../client-context.ts';
import { addEntry, historyKey, parseHistory, serializeHistory, type HistoryEntry } from './history.ts';

interface Loaded {
    readonly key: string;
    readonly entries: readonly HistoryEntry[];
    /* Whether the list differs from what the storage holds. */
    readonly changed: boolean;
}

export interface ConsoleHistory {
    readonly entries: readonly HistoryEntry[];
    record(entry: HistoryEntry): void;
    clear(): void;
}

const load = (storage: DatabaseStorage | undefined, key: string): Loaded => ({ key, entries: parseHistory(storage?.get(key) ?? null), changed: false });

/* The runs of one connection, kept in the app's storage when it has one and for the life of the console when it has not. */
export function useConsoleHistory(connectionId: string): ConsoleHistory {
    const storage = useDatabaseStorage();
    const key = historyKey(connectionId);
    const [state, setState] = useState<Loaded>(() => load(storage, key));

    if (state.key !== key) {
        setState(load(storage, key));
    }

    useEffect(() => {
        if (state.changed) {
            storage?.set(state.key, state.entries.length === 0 ? null : serializeHistory(state.entries));
        }
    }, [state, storage]);

    return {
        entries: state.entries,
        record: (entry) => setState((current) => ({ ...current, entries: addEntry(current.entries, entry), changed: true })),
        clear: () => setState((current) => ({ ...current, entries: [], changed: true }))
    };
}
