import { connectionOfKey, isFolderKey } from './tree.ts';

const VERSION = 1;

export interface Expansion {
    /* Connections, schemas and tables the person opened. */
    readonly expanded: ReadonlySet<string>;
    /* Folders the person closed, since a folder is open until then. */
    readonly collapsed: ReadonlySet<string>;
}

export const expansionKey = (connectionId: string): string => `database:explorer:${connectionId}`;

/* Reads what `serializeExpansion` wrote. Anything that does not fit gives nothing open and no folder closed. */
export const parseExpansion = (raw: string | null, connectionId: string): Expansion => {
    const none: Expansion = { expanded: new Set(), collapsed: new Set() };
    if (raw === null) {
        return none;
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || (parsed as { version?: unknown }).version !== VERSION) {
            return none;
        }
        const { expanded, collapsed } = parsed as { expanded?: unknown; collapsed?: unknown };
        const own = (keys: unknown, folders: boolean): Set<string> =>
            new Set(
                Array.isArray(keys)
                    ? keys.filter(
                          (key): key is string =>
                              typeof key === 'string' && key.length > 2 && isFolderKey(key) === folders && connectionOfKey(key) === connectionId
                      )
                    : []
            );
        return { expanded: own(expanded, false), collapsed: own(collapsed, true) };
    } catch {
        return none;
    }
};

/* What a connection has open as the text to store, or `null` when everything is as it starts, which removes the key. */
export const serializeExpansion = (connectionId: string, { expanded, collapsed }: Expansion): string | null => {
    const own = (keys: ReadonlySet<string>): string[] => [...keys].filter((key) => connectionOfKey(key) === connectionId).sort();
    const open = own(expanded);
    const closed = own(collapsed);
    return open.length === 0 && closed.length === 0 ? null : JSON.stringify({ version: VERSION, expanded: open, collapsed: closed });
};
