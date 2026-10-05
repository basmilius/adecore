import { useCallback, useEffect, useRef, useState } from 'react';
import type { DatabaseStorage } from '../actions.ts';
import { EMPTY_LAYOUT, parseStoredLayout, serializeLayout, type StoredLayout } from './layout-store.ts';

/* How long a change waits for the next before it is written, so a drag of a column edge is one write. */
export const STORE_DELAY_MS = 500;

export interface StoredLayoutHandle {
    /* What was stored when the view mounted, or `null` when nothing usable was. */
    readonly stored: StoredLayout | null;
    /* Merges a change into what is remembered and writes it after a pause. Does nothing without storage. */
    remember(change: Partial<StoredLayout>): void;
}

/*
 * The layout of one table's view in the app's storage. It is read once, on mount, and written back
 * in the background: the last change is still written when the view unmounts.
 */
export function useStoredLayout(storage: DatabaseStorage | undefined, key: string): StoredLayoutHandle {
    const [stored] = useState(() => (storage === undefined ? null : parseStoredLayout(storage.get(key))));
    const latest = useRef<StoredLayout>(stored ?? EMPTY_LAYOUT);
    const dirty = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const target = useRef({ storage, key });

    useEffect(() => {
        target.current = { storage, key };
    });

    const write = useCallback((): void => {
        clearTimeout(timer.current);
        timer.current = undefined;
        if (dirty.current) {
            dirty.current = false;
            target.current.storage?.set(target.current.key, serializeLayout(latest.current));
        }
    }, []);

    useEffect(() => write, [write]);

    return {
        stored,
        remember: (change) => {
            if (storage === undefined) {
                return;
            }
            latest.current = { ...latest.current, ...change };
            dirty.current = true;
            clearTimeout(timer.current);
            timer.current = setTimeout(write, STORE_DELAY_MS);
        }
    };
}
