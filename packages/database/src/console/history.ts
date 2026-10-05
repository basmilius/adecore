/* One run of the console, as the history list keeps it. */
export interface HistoryEntry {
    readonly sql: string;
    /* Milliseconds since the epoch. */
    readonly at: number;
    /* The name the connection had at the time. */
    readonly connection: string;
    readonly ok: boolean;
    /* Rows read or affected, summed over the statements; `null` when the run failed before any count. */
    readonly rows: number | null;
}

export const HISTORY_LIMIT = 200;

export const historyKey = (connectionId: string): string => `database:console-history:${connectionId}`;

const isEntry = (value: unknown): value is HistoryEntry => {
    if (value === null || typeof value !== 'object') {
        return false;
    }
    const entry = value as Record<string, unknown>;
    return (
        typeof entry.sql === 'string' &&
        typeof entry.at === 'number' &&
        typeof entry.connection === 'string' &&
        typeof entry.ok === 'boolean' &&
        (entry.rows === null || typeof entry.rows === 'number')
    );
};

/* Reads what `serializeHistory` wrote. Anything that does not fit gives an empty list, or leaves out the entries that do not fit. */
export const parseHistory = (raw: string | null): HistoryEntry[] => {
    if (raw === null) {
        return [];
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, HISTORY_LIMIT) : [];
    } catch {
        return [];
    }
};

export const serializeHistory = (entries: readonly HistoryEntry[]): string => JSON.stringify(entries);

/* The list with the run in front. A run of the same SQL as the latest one replaces it. */
export const addEntry = (entries: readonly HistoryEntry[], entry: HistoryEntry): HistoryEntry[] => {
    const rest = entries[0]?.sql.trim() === entry.sql.trim() ? entries.slice(1) : entries;
    return [entry, ...rest].slice(0, HISTORY_LIMIT);
};

/* The entries whose SQL holds every word of the query, in any case. */
export const searchHistory = (entries: readonly HistoryEntry[], query: string): readonly HistoryEntry[] => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return entries;
    }
    return entries.filter((entry) => {
        const sql = entry.sql.toLowerCase();
        return words.every((word) => sql.includes(word));
    });
};
