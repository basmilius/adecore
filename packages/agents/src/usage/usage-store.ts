import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { appendFile, mkdir, readFile, rename, truncate } from 'node:fs/promises';
import { join } from 'node:path';
import { errorText } from '../error-text.ts';
import { isNotFound, removeFile, writeAtomic } from '../fs.ts';
import { applyEntry, decodeHistory, encodeEntry, encodeHeader, type FileUsage, type HistoryEntry } from './history-file.ts';
import { decodeIndex } from './index-file.ts';
import { foldByKey, type UsageRecord } from './record.ts';
import { decodeState, encodeState, type ScanState } from './scan-state.ts';

const HISTORY_FILE = 'history.jsonl';
const STATE_FILE = 'scan-state.json';
const LEGACY_INDEX_FILE = 'index.json';
// Below this, appended lines are not worth a rewrite of the whole history.
const COMPACT_FLOOR_BYTES = 1 << 20;

async function readOptional(path: string): Promise<Buffer | null> {
    try {
        return await readFile(path);
    } catch (e) {
        if (isNotFound(e)) {
            return null;
        }

        throw e;
    }
}

/*
 * The usage of every transcript ever read, kept apart from where the scanner left each one. The state
 * is saved after the lines it accounts for, against the history's size, so after a crash in between it
 * does not match: it is dropped and every transcript is read from the start again, which replaces what
 * a path counted instead of adding to it.
 */
export class UsageStore {
    readonly usage = new Map<string, FileUsage>();
    readonly state = new Map<string, ScanState>();
    private readonly dir: string;
    private pending: HistoryEntry[] = [];
    private stateDirty = false;
    private gen: string | null = null;
    private base = 0;
    private bytes = 0;
    // Set when the history on disk may not end where this store thinks it does.
    private rewriteNext = false;

    constructor(dir: string) {
        this.dir = dir;
    }

    async load(): Promise<void> {
        this.usage.clear();
        this.state.clear();
        const history = await readOptional(join(this.dir, HISTORY_FILE));

        if (history === null) {
            await this.migrate();

            return;
        }

        const decoded = decodeHistory(history);

        for (const [path, usage] of decoded.usage) {
            this.usage.set(path, usage);
        }

        if (decoded.complete < history.length) {
            await truncate(join(this.dir, HISTORY_FILE), decoded.complete);
        }

        this.gen = decoded.header?.gen ?? null;
        this.base = decoded.header?.base ?? 0;
        this.bytes = decoded.complete;
        this.rewriteNext = this.gen === null;

        const saved = await readOptional(join(this.dir, STATE_FILE));
        const state = saved === null ? null : decodeState(saved.toString('utf8'));

        if (state !== null && state.history.gen === this.gen && state.history.bytes === this.bytes) {
            for (const [path, file] of state.files) {
                this.state.set(path, file);
            }
        }

        // A migration that stopped after writing the history; the index has nothing the history lacks.
        await removeFile(join(this.dir, LEGACY_INDEX_FILE));
    }

    records(): UsageRecord[] {
        const all: UsageRecord[] = [];

        for (const file of this.usage.values()) {
            all.push(...file.records, ...file.tail);
        }

        return foldByKey(all);
    }

    /* A transcript read from the start: what it counts now replaces what it counted. */
    replace(path: string, usage: FileUsage, state: ScanState): void {
        this.setState(path, state);

        if (isDeepStrictEqual(this.usage.get(path), usage)) {
            return;
        }

        this.usage.set(path, usage);
        this.pending.push({ path, op: 'set', usage });
    }

    /* A transcript read from where it was left: `added` counts on top of what it had. */
    append(path: string, added: FileUsage, state: ScanState): void {
        this.setState(path, state);
        const known = this.usage.get(path);

        if (added.records.length === 0 && known?.provider === added.provider && isDeepStrictEqual(known.tail, added.tail)) {
            return;
        }

        const entry: HistoryEntry = { path, op: 'add', usage: { ...added, records: foldByKey(added.records) } };
        applyEntry(this.usage, entry);
        this.pending.push(entry);
    }

    /* Where the scanner left a transcript that is gone; what it counted stays. */
    forget(path: string): void {
        if (this.state.delete(path)) {
            this.stateDirty = true;
        }
    }

    async commit(): Promise<void> {
        if (this.pending.length === 0 && !this.stateDirty) {
            return;
        }

        await mkdir(this.dir, { recursive: true, mode: 0o700 });

        try {
            if (this.rewriteNext || (this.pending.length > 0 && this.gen === null)) {
                await this.rewrite();
            } else if (this.pending.length > 0) {
                await this.appendPending();
            }

            await this.saveState();
        } catch (e) {
            // What failed to land is in memory, and a rewrite puts all of it on disk.
            this.pending = [];
            this.rewriteNext = true;

            throw e;
        }
    }

    private setState(path: string, state: ScanState): void {
        this.state.set(path, state);
        this.stateDirty = true;
    }

    private async appendPending(): Promise<void> {
        const text = this.pending.map(encodeEntry).join('');
        this.pending = [];
        await appendFile(join(this.dir, HISTORY_FILE), text, { mode: 0o600 });
        this.bytes += Buffer.byteLength(text);

        if (this.bytes > 2 * this.base && this.bytes - this.base > COMPACT_FLOOR_BYTES) {
            await this.rewrite();
        }
    }

    /* The history as one `set` line per path, which drops every line a later one superseded. */
    private async rewrite(): Promise<void> {
        const lines = [...this.usage].map(([path, usage]) => encodeEntry({ path, op: 'set', usage }));
        const gen = randomUUID();
        const body = lines.join('');
        const base = Buffer.byteLength(body);
        const header = encodeHeader({ gen, base });

        this.pending = [];
        await writeAtomic(join(this.dir, HISTORY_FILE), header + body);
        this.gen = gen;
        this.base = base;
        this.bytes = Buffer.byteLength(header + body);
        this.rewriteNext = false;
    }

    private async saveState(): Promise<void> {
        if (this.gen === null) {
            return;
        }

        await writeAtomic(join(this.dir, STATE_FILE), encodeState(this.state, { gen: this.gen, bytes: this.bytes }));
        this.stateDirty = false;
    }

    /*
     * Moves an index of the single-file format into history and scan state. The history goes first:
     * once it is there, a load treats the index as moved, so an interrupted migration finishes on the next load.
     */
    private async migrate(): Promise<void> {
        const legacy = join(this.dir, LEGACY_INDEX_FILE);
        const text = await readOptional(legacy);

        if (text === null) {
            return;
        }

        const index = decodeIndex(text.toString('utf8'));

        if (index === null) {
            console.warn('The usage index would not read; it is kept beside a fresh history.');
            await rename(legacy, `${legacy}.unreadable`);

            return;
        }

        for (const [path, file] of index) {
            const { records, tail, provider, ...state } = file;
            this.usage.set(path, { provider, records, tail });
            this.state.set(path, { provider, ...state });
        }

        try {
            await this.rewrite();
            await this.saveState();
            await removeFile(legacy);
        } catch (e) {
            // The index stays and is moved again on the next load; this run counts from memory.
            this.rewriteNext = true;
            this.stateDirty = true;
            console.warn('The usage index could not be moved to the history yet:', errorText(e));
        }
    }
}
