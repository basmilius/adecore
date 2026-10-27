/* One copy or cut, as the editors of a project made it. */
export interface ClipboardEntry {
    readonly text: string;
    /* The copy took the lines of bare carets, which paste back above the lines of bare carets. */
    readonly wholeLines: boolean;
    readonly at: number;
}

export interface ClipboardHistoryOptions {
    /* How many entries the history keeps; 100. */
    readonly limit?: number;
    /* The UTF-16 length all entries may take together; 10,000,000. The oldest go first, and the newest stays even when it alone is longer. */
    readonly maxLength?: number;
    /* What a host kept, newest first. */
    readonly entries?: readonly ClipboardEntry[];
    /* Told after every change, for a host that keeps the entries. */
    onChange?(entries: readonly ClipboardEntry[]): void;
    readonly clock?: () => number;
}

/* The texts copied or cut in the editors of a project, newest first, for Paste from History. */
export class ClipboardHistory {
    private readonly limit: number;
    private readonly maxLength: number;
    private readonly onChange: ((entries: readonly ClipboardEntry[]) => void) | undefined;
    private readonly clock: () => number;
    private readonly listeners = new Set<() => void>();
    private list: readonly ClipboardEntry[];

    constructor(options: ClipboardHistoryOptions = {}) {
        this.limit = options.limit ?? 100;
        this.maxLength = options.maxLength ?? 10_000_000;
        this.onChange = options.onChange;
        this.clock = options.clock ?? Date.now;
        this.list = this.trimmed(options.entries ?? []);
    }

    /* Newest first. */
    get entries(): readonly ClipboardEntry[] {
        return this.list;
    }

    /* Puts a copy on top. The same text again moves up instead of being kept twice, and nothing is kept for an empty text. */
    add(text: string, options: { readonly wholeLines?: boolean } = {}): void {
        if (text === '') {
            return;
        }

        const entry = { text, wholeLines: options.wholeLines === true, at: this.clock() };

        this.change([entry, ...this.list.filter((other) => other.text !== text)]);
    }

    remove(entry: ClipboardEntry): void {
        if (this.list.includes(entry)) {
            this.change(this.list.filter((other) => other !== entry));
        }
    }

    /* Moves an entry to the top, as choosing it does. */
    promote(entry: ClipboardEntry): void {
        if (this.list.includes(entry) && this.list[0] !== entry) {
            this.change([entry, ...this.list.filter((other) => other !== entry)]);
        }
    }

    clear(): void {
        if (this.list.length > 0) {
            this.change([]);
        }
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    }

    private change(entries: readonly ClipboardEntry[]): void {
        this.list = this.trimmed(entries);
        this.onChange?.(this.list);
        this.listeners.forEach((listener) => listener());
    }

    /* Keeps the newest entries that fit the limit and the total length. */
    private trimmed(entries: readonly ClipboardEntry[]): readonly ClipboardEntry[] {
        const kept: ClipboardEntry[] = [];
        let length = 0;

        for (const entry of entries.slice(0, this.limit)) {
            length += entry.text.length;

            if (kept.length > 0 && length > this.maxLength) {
                break;
            }

            kept.push(entry);
        }

        return kept;
    }
}
