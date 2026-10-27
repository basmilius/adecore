import { UsageProviderSchema, type UsageProvider } from '@adecore/agent-contracts';
import { foldByKey, type UsageRecord } from './record.ts';
import { CURRENT_ROW, decodeRows, RowWriter, type RecordRow } from './rows.ts';

const HISTORY_VERSION = 1;
const NEWLINE = 0x0a;

/* What the transcript at one path has counted, kept after the transcript itself is gone. */
export interface FileUsage {
    provider: UsageProvider;
    records: UsageRecord[];
    /* What the line still being written at the end of the transcript says; replaced on every read of it. */
    tail: UsageRecord[];
}

/*
 * One line of the history. `set` replaces what a path counted, since its transcript was read from the
 * start; `add` folds its records into what the path had, since they came from an append.
 */
export interface HistoryEntry {
    path: string;
    op: 'set' | 'add';
    usage: FileUsage;
}

/*
 * The first line. `gen` is new on every rewrite of the file, so scan state saved against another
 * rewrite is never trusted; `base` is the size of the lines it was rewritten with, which says when to
 * rewrite it again.
 */
export interface HistoryHeader {
    gen: string;
    base: number;
}

/* Each line names its own models, sessions and folders, so it reads back without the lines before it. */
interface EntryLine {
    p: string;
    k: UsageProvider;
    op: 'set' | 'add';
    m: string[];
    s: string[];
    f: string[];
    a: string[];
    r: RecordRow[];
    t: RecordRow[];
}

export function encodeHeader(header: HistoryHeader): string {
    return `${JSON.stringify({ v: HISTORY_VERSION, gen: header.gen, base: header.base })}\n`;
}

export function encodeEntry(entry: HistoryEntry): string {
    const writer = new RowWriter();
    const r = entry.usage.records.map((record) => writer.row(record));
    const t = entry.usage.tail.map((record) => writer.row(record));
    const { models, sessions, folders, accounts } = writer.tables;
    const line: EntryLine = { p: entry.path, k: entry.usage.provider, op: entry.op, m: models, s: sessions, f: folders, a: accounts, r, t };

    return `${JSON.stringify(line)}\n`;
}

function parseLine(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function decodeHeader(text: string): HistoryHeader | null {
    const header = parseLine(text) as Partial<HistoryHeader & { v: number }> | null;

    if (header?.v !== HISTORY_VERSION || typeof header.gen !== 'string' || typeof header.base !== 'number') {
        return null;
    }

    return { gen: header.gen, base: header.base };
}

function decodeEntry(text: string): HistoryEntry | null {
    const line = parseLine(text) as Partial<EntryLine> | null;

    if (typeof line?.p !== 'string' || (line.op !== 'set' && line.op !== 'add') || !UsageProviderSchema.safeParse(line.k).success) {
        return null;
    }

    const provider = line.k as UsageProvider;
    const tables = { models: line.m, sessions: line.s, folders: line.f, accounts: line.a };
    const records = decodeRows(line.r, tables, provider, CURRENT_ROW);
    const tail = decodeRows(line.t, tables, provider, CURRENT_ROW);

    if (records === null || tail === null) {
        return null;
    }

    return { path: line.p, op: line.op, usage: { provider, records, tail } };
}

/* Folds one line into what every path counted. */
export function applyEntry(usage: Map<string, FileUsage>, entry: HistoryEntry): void {
    const known = usage.get(entry.path);

    if (entry.op === 'set' || known === undefined || known.provider !== entry.usage.provider) {
        usage.set(entry.path, entry.usage);

        return;
    }

    usage.set(entry.path, { provider: known.provider, records: foldByKey([...known.records, ...entry.usage.records]), tail: entry.usage.tail });
}

export interface DecodedHistory {
    header: HistoryHeader | null;
    usage: Map<string, FileUsage>;
    /* The bytes up to the last newline; past it is a line an append left half-written. */
    complete: number;
}

/*
 * Every line stands alone, so a line that does not read back costs only that line. Only the end can
 * be half-written, since lines are only ever appended.
 */
export function decodeHistory(bytes: Uint8Array): DecodedHistory {
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const complete = buffer.lastIndexOf(NEWLINE) + 1;
    const lines = buffer.toString('utf8', 0, complete).split('\n');
    const usage = new Map<string, FileUsage>();
    const header = complete === 0 ? null : decodeHeader(lines[0]!);

    for (let i = header === null ? 0 : 1; i < lines.length; i++) {
        const entry = lines[i] === '' ? null : decodeEntry(lines[i]!);

        if (entry !== null) {
            applyEntry(usage, entry);
        }
    }

    return { header, usage, complete };
}
