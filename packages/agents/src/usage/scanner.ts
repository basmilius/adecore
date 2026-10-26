import { createHash, type Hash } from 'node:crypto';
import { mkdir, open, readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { createZstdDecompress } from 'node:zlib';
import type { UsageProvider, UsageRoot } from '@adecore/agent-contracts';
import { errorText } from '../error-text.ts';
import { isNotFound, writeAtomic } from '../fs.ts';
import { decodeIndex, encodeIndex, type IndexedFile, type UsageIndex } from './index-file.ts';
import { foldByKey, type UsageRecord } from './record.ts';
import { claudeMightCarryUsage, parseClaudeLine } from './readers/claude.ts';
import { GROK_USAGE_FILE, parseGrokUsage } from './readers/grok.ts';
import { hostLogMightCarryUsage, parseHostUsageLine } from './readers/host-log.ts';
import { cloneCodexState, codexMightCarryUsage, createCodexState, parseCodexLine, type CodexParserState } from './readers/codex.ts';
import { usageRoots, type UsageRootPath } from './roots.ts';

const HASH_CHUNK_BYTES = 65536;
// How much of a transcript is read at once. Codex writes sessions of more than a gigabyte, which read whole held several times their size.
const READ_CHUNK_BYTES = 1 << 20;
const CODEX_PARSER_VERSION = 2;
const NEWLINE = 0x0a;

/* Hashes the first `length` bytes of a file into `hash`, a chunk at a time. */
async function hashPrefix(path: string, length: number, hash: Hash): Promise<Hash> {
    const handle = await open(path, 'r');

    try {
        const chunk = Buffer.alloc(Math.min(length, HASH_CHUNK_BYTES));
        let offset = 0;

        while (offset < length) {
            const { bytesRead } = await handle.read(chunk, 0, Math.min(chunk.length, length - offset), offset);

            if (bytesRead === 0) {
                break;
            }

            hash.update(chunk.subarray(0, bytesRead));
            offset += bytesRead;
        }

        return hash;
    } finally {
        await handle.close();
    }
}

export interface LineRead {
    /* The bytes of every whole line, newlines included. */
    consumed: number;
    /* What follows the last newline: a line still being written. */
    rest: string;
}

/*
 * Hands every whole line of a byte stream to `onLine` and hashes it with its newline, holding no more
 * than a chunk and the line it is in. Lines are split on the byte, which never occurs inside a UTF-8 sequence.
 */
export async function forEachLine(chunks: AsyncIterable<Uint8Array>, hash: Hash, onLine: (line: string) => void): Promise<LineRead> {
    let consumed = 0;
    let pending: Buffer[] = [];

    for await (const piece of chunks) {
        const chunk = Buffer.from(piece.buffer, piece.byteOffset, piece.byteLength);
        let start = 0;
        let newline = chunk.indexOf(NEWLINE, start);

        while (newline !== -1) {
            const end = newline + 1;
            const line = pending.length === 0 ? chunk.subarray(start, end) : Buffer.concat([...pending, chunk.subarray(start, end)]);
            pending = [];
            hash.update(line);
            consumed += line.length;
            onLine(line.toString('utf8', 0, line.length - 1));
            start = end;
            newline = chunk.indexOf(NEWLINE, start);
        }

        if (start < chunk.length) {
            // A copy: the stream may hand the same memory out again for its next chunk.
            pending.push(Buffer.from(chunk.subarray(start)));
        }
    }

    return { consumed, rest: Buffer.concat(pending).toString('utf8') };
}

/* Covers every committed byte, since a transcript can be rewritten after an unchanged session header. */
function headOf(hash: Hash): string {
    // Older indexes hashed only the first 4 KB; they cannot establish that the rest stayed unchanged.
    return `sha256:${hash.copy().digest('base64')}`;
}

export interface ScanReport {
    at: number;
    files: number;
    changedFiles: number;
    durationMs: number;
    roots: UsageRoot[];
}

interface ParsedFile {
    records: UsageRecord[];
    tail: UsageRecord[];
    offset: number;
    codex: CodexParserState | null;
}

/* A log of lines for every provider but Grok, which keeps one JSON file per session that it rewrites whole. */
function readsWhole(provider: UsageProvider): boolean {
    return provider === 'grok';
}

function isUsageFile(provider: UsageProvider, name: string): boolean {
    return readsWhole(provider) ? name === GROK_USAGE_FILE : name.endsWith('.jsonl') || (provider === 'codex' && name.endsWith('.jsonl.zst'));
}

async function listUsageFiles(dir: string, provider: UsageProvider, out: string[] = []): Promise<string[]> {
    let entries;

    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        // A directory that cannot be read is one the scan walks past; the root itself reports status.
        return out;
    }

    for (const entry of entries) {
        const path = join(dir, entry.name);

        if (entry.isDirectory()) {
            await listUsageFiles(path, provider, out);
        } else if (entry.isFile() && isUsageFile(provider, entry.name)) {
            out.push(path);
        }
    }

    return out;
}

/* The bytes of a file from `from` to its end, a chunk at a time. */
async function* fileChunks(path: string, from: number): AsyncGenerator<Uint8Array> {
    const handle = await open(path, 'r');

    try {
        let position = from;

        for (;;) {
            // A buffer per chunk: a decompressor may still hold the one before.
            const chunk = Buffer.alloc(READ_CHUNK_BYTES);
            const { bytesRead } = await handle.read(chunk, 0, chunk.length, position);

            if (bytesRead === 0) {
                return;
            }

            position += bytesRead;
            yield chunk.subarray(0, bytesRead);
        }
    } finally {
        await handle.close();
    }
}

/* The bytes of a file from `from` on, decompressed for a `.zst` one; a failure on either side ends the iteration with it. */
function readBytes(path: string, from: number, compressed: boolean): AsyncIterable<Uint8Array> {
    if (!compressed) {
        return fileChunks(path, from);
    }

    const source = Readable.from(fileChunks(path, from));
    const decompressed = createZstdDecompress();
    source.on('error', (error) => decompressed.destroy(error));

    return source.pipe(decompressed);
}

/* The usage record of one transcript line, when it carries one. */
function parseLine(raw: string, provider: UsageProvider, codex: CodexParserState | null): UsageRecord | null {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;

    if (line === '') {
        return null;
    }

    if (provider === 'claude') {
        return claudeMightCarryUsage(line) ? parseClaudeLine(line) : null;
    }

    if (provider === 'codex') {
        return codex !== null && codexMightCarryUsage(line) ? parseCodexLine(line, codex) : null;
    }

    // Claude Code and Codex write transcripts of their own, Grok a file read whole; every other provider is a log its host keeps.
    return hostLogMightCarryUsage(line) ? parseHostUsageLine(line, provider) : null;
}

/*
 * Reads what a file added since the last scan. Only whole lines count towards the offset; the piece
 * after the last newline is a line still being written, so it is parsed for what it is worth and
 * read again next time. The Codex state is snapshotted before that tail for the same reason.
 */
async function parseLines(
    chunks: AsyncIterable<Uint8Array>,
    hash: Hash,
    provider: UsageProvider,
    from: number,
    state: CodexParserState | null
): Promise<ParsedFile> {
    const codex = provider === 'codex' ? (state ?? createCodexState()) : null;
    const records: UsageRecord[] = [];

    const read = await forEachLine(chunks, hash, (line) => {
        const record = parseLine(line, provider, codex);

        if (record !== null) {
            records.push(record);
        }
    });

    const committed = codex === null ? null : cloneCodexState(codex);
    const tail = parseLine(read.rest, provider, codex);

    return { records, tail: tail === null ? [] : [tail], offset: from + read.consumed, codex: committed };
}

export interface UsageScannerOptions {
    /* The account of every session the host knows ran, by `<provider>\0<sessionId>`, the default one under its kind. */
    sessionAccounts?: () => ReadonlyMap<string, string>;
}

type AccountOf = (record: UsageRecord) => string | undefined;

/*
 * The account a record of a root belongs to, as a record keeps it (absent for the default account):
 * the one account that writes there, else the one the host knows ran the session, else the
 * default account of the CLI, which is the only one a session nobody started through the host ran under.
 */
export function accountResolver(root: UsageRootPath, sessionAccounts: () => ReadonlyMap<string, string>): AccountOf {
    const accounts = root.accounts ?? [root.provider];

    const stored = (id: string): string | undefined => (id === root.provider ? undefined : id);

    if (accounts.length === 1) {
        const only = stored(accounts[0]!);

        return () => only;
    }

    const fallback = accounts.includes(root.provider) ? root.provider : accounts[0]!;

    return (record) => {
        const ran = sessionAccounts().get(`${root.provider}\0${record.sessionId}`);

        return stored(ran !== undefined && accounts.includes(ran) ? ran : fallback);
    };
}

function withAccount(records: UsageRecord[], accountOf: AccountOf): UsageRecord[] {
    return records.map((record) => {
        const account = accountOf(record);

        return account === undefined ? record : { ...record, account };
    });
}

/*
 * Parses only what a transcript appended since the last scan, and starts a file over once it was
 * rewritten or cut. A deleted transcript keeps its totals, since its usage still happened.
 */
export class UsageScanner {
    private readonly home: string;
    private readonly roots: () => UsageRootPath[];
    private readonly sessionAccounts: () => ReadonlyMap<string, string>;
    private index: UsageIndex = new Map();
    private loaded = false;
    private dirty = false;

    /* `roots` as a function is asked again on every scan, so an account added since is walked too. */
    constructor(home: string, roots: UsageRootPath[] | (() => UsageRootPath[]) = usageRoots(), options: UsageScannerOptions = {}) {
        this.home = home;
        this.roots = typeof roots === 'function' ? roots : () => roots;
        this.sessionAccounts = options.sessionAccounts ?? (() => new Map());
    }

    private get file(): string {
        return join(this.home, 'usage', 'index.json');
    }

    async load(): Promise<void> {
        if (this.loaded) {
            return;
        }

        this.loaded = true;

        try {
            this.index = decodeIndex(await readFile(this.file, 'utf8'));
        } catch (e) {
            if (!isNotFound(e)) {
                console.warn('The usage index would not read; starting from a cold scan:', errorText(e));
            }
        }
    }

    async scan(): Promise<ScanReport> {
        const started = Date.now();
        await this.load();
        const roots: UsageRoot[] = [];
        let files = 0;
        let changedFiles = 0;
        let sessions: ReadonlyMap<string, string> | null = null;

        const sessionAccounts = (): ReadonlyMap<string, string> => {
            sessions ??= this.sessionAccounts();

            return sessions;
        };

        for (const root of this.roots()) {
            try {
                const info = await stat(root.path);

                if (!info.isDirectory()) {
                    roots.push({ provider: root.provider, path: root.path, status: 'missing', message: null });

                    continue;
                }
            } catch (e) {
                const missing = isNotFound(e);

                roots.push({
                    provider: root.provider,
                    path: root.path,
                    status: missing ? 'missing' : 'failed',
                    message: missing ? null : errorText(e)
                });

                continue;
            }

            let failure: string | null = null;
            const accountOf = accountResolver(root, sessionAccounts);
            const paths = await listUsageFiles(root.path, root.provider);
            const plain = new Set(paths);

            for (const path of paths) {
                if (root.provider === 'codex' && path.endsWith('.jsonl.zst') && plain.has(path.slice(0, -4))) {
                    continue;
                }

                files += 1;

                try {
                    if (await this.readFileInto(path, root.provider, accountOf)) {
                        changedFiles += 1;
                    }
                } catch (e) {
                    // One unreadable transcript is not the root failing; the count simply misses it.
                    failure ??= errorText(e);
                }
            }

            roots.push({ provider: root.provider, path: root.path, status: failure === null ? 'ok' : 'failed', message: failure });
        }

        if (this.dirty) {
            this.dirty = false;
            await mkdir(join(this.home, 'usage'), { recursive: true, mode: 0o700 });
            await writeAtomic(this.file, encodeIndex(this.index));
        }

        return { at: Date.now(), files, changedFiles, durationMs: Date.now() - started, roots };
    }

    /* Every record the index holds, with the copies one message left in several transcripts folded. */
    records(): UsageRecord[] {
        const all: UsageRecord[] = [];

        for (const file of this.index.values()) {
            all.push(...file.records, ...file.tail);
        }

        return foldByKey(all);
    }

    private async readFileInto(path: string, provider: UsageProvider, accountOf: AccountOf): Promise<boolean> {
        const info = await stat(path);
        const compressed = provider === 'codex' && path.endsWith('.jsonl.zst');
        const key = compressed ? path.slice(0, -4) : path;
        const known = this.index.get(key);
        const currentParser = provider !== 'codex' || known?.parserVersion === CODEX_PARSER_VERSION;

        if (
            currentParser &&
            known !== undefined &&
            known.provider === provider &&
            (known.compressed ?? false) === compressed &&
            known.size === info.size &&
            known.mtimeMs === info.mtimeMs
        ) {
            return false;
        }

        if (readsWhole(provider)) {
            return this.readWholeInto(path, provider, accountOf, info);
        }

        const appended =
            !compressed &&
            currentParser &&
            known?.compressed !== true &&
            known !== undefined &&
            known.provider === provider &&
            info.size > known.size &&
            known.head?.startsWith('sha256:') === true;

        // A file only counts as grown while it starts the way it did; one rewritten larger is read again from the start.
        const prefix = appended ? await hashPrefix(path, known.offset, createHash('sha256')) : null;
        const grown = prefix !== null && known !== undefined && headOf(prefix) === known.head ? known : null;
        const hash = grown === null || prefix === null ? createHash('sha256') : prefix;
        const from = grown?.offset ?? 0;
        const parsed = await parseLines(readBytes(path, from, compressed), hash, provider, from, grown?.codex ?? null);
        const before = grown?.records ?? [];

        const entry: IndexedFile = {
            provider,
            size: info.size,
            mtimeMs: info.mtimeMs,
            offset: parsed.offset,
            // Folding here keeps the streaming copies of one message out of the index entirely.
            records: foldByKey([...before, ...withAccount(parsed.records, accountOf)]),
            tail: withAccount(parsed.tail, accountOf),
            codex: parsed.codex,
            head: headOf(hash),
            ...(provider === 'codex' ? { parserVersion: CODEX_PARSER_VERSION, compressed } : {})
        };

        this.index.set(key, entry);
        this.dirty = true;

        return true;
    }

    /*
     * A file rewritten as a whole replaces what the index held of it, so a turn it still lists is never
     * counted twice. One that does not parse, such as one caught halfway through a write, keeps the
     * records it had and is read again on the next scan.
     */
    private async readWholeInto(path: string, provider: UsageProvider, accountOf: AccountOf, info: { size: number; mtimeMs: number }): Promise<boolean> {
        const records = parseGrokUsage(await readFile(path, 'utf8'), path);

        if (records === null) {
            return false;
        }

        this.index.set(path, {
            provider,
            size: info.size,
            mtimeMs: info.mtimeMs,
            offset: info.size,
            records: foldByKey(withAccount(records, accountOf)),
            tail: [],
            codex: null,
            head: null
        });

        this.dirty = true;

        return true;
    }
}
