import { useEffect, useRef, useState } from 'react';
import type { DatabaseStorage } from '../actions.ts';
import { useDatabaseStorage } from '../client-context.ts';
import type { Connection } from '../client/types.ts';
import { expansionKey, parseExpansion, serializeExpansion, type Expansion } from './expansion.ts';

type Update = (current: ReadonlySet<string>) => ReadonlySet<string>;

interface Loaded extends Expansion {
    /* The connections whose stored state is in the sets. */
    readonly loaded: ReadonlySet<string>;
}

const restore = (storage: DatabaseStorage | undefined, connections: readonly Connection[], from: Loaded): Loaded => {
    const expanded = new Set(from.expanded);
    const collapsed = new Set(from.collapsed);
    const loaded = new Set(from.loaded);
    for (const { id } of connections) {
        if (loaded.has(id)) {
            continue;
        }
        loaded.add(id);
        const stored = parseExpansion(storage?.get(expansionKey(id)) ?? null, id);
        stored.expanded.forEach((key) => expanded.add(key));
        stored.collapsed.forEach((key) => collapsed.add(key));
    }
    return { expanded, collapsed, loaded };
};

export interface StoredExpansion extends Expansion {
    setExpanded(update: Update): void;
    setCollapsed(update: Update): void;
}

/*
 * Which nodes of the tree are open, kept per connection in the app's storage when it has one. A
 * connection that shows up later is restored when it does.
 */
export function useStoredExpansion(connections: readonly Connection[]): StoredExpansion {
    const storage = useDatabaseStorage();
    const [state, setState] = useState<Loaded>(() => restore(storage, connections, { expanded: new Set(), collapsed: new Set(), loaded: new Set() }));
    // What the storage holds per connection, so only a change is written back.
    const written = useRef(new Map<string, string | null>());

    if (connections.some((connection) => !state.loaded.has(connection.id))) {
        setState((current) => restore(storage, connections, current));
    }

    useEffect(() => {
        for (const id of state.loaded) {
            const next = serializeExpansion(id, state);
            const last = written.current.get(id);
            written.current.set(id, next);
            if (last !== undefined && last !== next) {
                storage?.set(expansionKey(id), next);
            }
        }
    }, [storage, state]);

    return {
        expanded: state.expanded,
        collapsed: state.collapsed,
        setExpanded: (update) => setState((current) => ({ ...current, expanded: update(current.expanded) })),
        setCollapsed: (update) => setState((current) => ({ ...current, collapsed: update(current.collapsed) }))
    };
}
