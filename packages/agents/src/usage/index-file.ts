import { UsageProviderSchema, type UsageProvider } from '@adecore/agent-contracts';
import type { UsageRecord } from './record.ts';
import type { CodexParserState } from './readers/codex.ts';
import { CURRENT_ROW, decodeRows, RowWriter, type RecordRow } from './rows.ts';

/*
 * The single index usage was kept in before history and scan state went apart. The store reads it
 * once to migrate it; nothing writes it any more but the tests that need one to migrate.
 */
const INDEX_VERSION = 3;
/* Before accounts: every record was the default account's, so it reads as that without a scan. */
const ACCOUNTLESS_VERSION = 1;

export interface IndexedFile {
    provider: UsageProvider;
    size: number;
    mtimeMs: number;
    offset: number;
    records: UsageRecord[];
    tail: UsageRecord[];
    codex: CodexParserState | null;
    head: string | null;
    parserVersion?: number;
    compressed?: boolean;
}

export type UsageIndex = Map<string, IndexedFile>;

interface FileRow {
    p: UsageProvider;
    s: number;
    m: number;
    o: number;
    r: RecordRow[];
    t: RecordRow[];
    c: CodexParserState | null;
    h?: string;
    v?: number;
    z?: boolean;
}

interface IndexFile {
    version: number;
    models: string[];
    sessions: string[];
    folders: string[];
    accounts?: string[];
    files: Record<string, FileRow>;
}

export function encodeIndex(index: UsageIndex): string {
    const writer = new RowWriter();
    const files: Record<string, FileRow> = {};

    for (const [path, file] of index) {
        files[path] = {
            p: file.provider,
            s: file.size,
            m: file.mtimeMs,
            o: file.offset,
            c: file.codex,
            r: file.records.map((record) => writer.row(record)),
            t: file.tail.map((record) => writer.row(record)),
            ...(file.head === null ? {} : { h: file.head }),
            ...(file.parserVersion === undefined ? {} : { v: file.parserVersion }),
            ...(file.compressed === undefined ? {} : { z: file.compressed })
        };
    }

    const document: IndexFile = { version: INDEX_VERSION, ...writer.tables, files };

    return JSON.stringify(document);
}

/*
 * Null for text that is no index of a version this reads. A file whose rows do not read back is left
 * out, so only that file's usage is missing from what migrates, never a wrong total.
 */
export function decodeIndex(text: string): UsageIndex | null {
    let document: IndexFile;

    try {
        document = JSON.parse(text) as IndexFile;
    } catch {
        return null;
    }

    const version = document?.version;

    if (
        (version !== INDEX_VERSION && version !== 2 && version !== ACCOUNTLESS_VERSION) ||
        !Array.isArray(document.models) ||
        !Array.isArray(document.sessions) ||
        !Array.isArray(document.folders)
    ) {
        return null;
    }

    const index: UsageIndex = new Map();
    const tables = { ...document, accounts: Array.isArray(document.accounts) ? document.accounts : [] };
    const shape = { accountless: version === ACCOUNTLESS_VERSION, maxLength: version === INDEX_VERSION ? CURRENT_ROW.maxLength : 14 };

    for (const [path, file] of Object.entries(document.files ?? {})) {
        // Every provider the schema knows, so a new one is never dropped from the index it was saved in.
        if (!UsageProviderSchema.safeParse(file.p).success) {
            continue;
        }

        if (typeof file.s !== 'number' || typeof file.m !== 'number' || typeof file.o !== 'number' || file.o < 0) {
            continue;
        }

        const records = decodeRows(file.r, tables, file.p, shape);
        const tail = decodeRows(Array.isArray(file.t) ? file.t : [], tables, file.p, shape);

        if (records === null || tail === null) {
            continue;
        }

        index.set(path, {
            provider: file.p,
            size: file.s,
            mtimeMs: file.m,
            offset: file.o,
            records,
            tail,
            codex: file.c ?? null,
            head: typeof file.h === 'string' ? file.h : null,
            ...(typeof file.v === 'number' ? { parserVersion: file.v } : {}),
            ...(typeof file.z === 'boolean' ? { compressed: file.z } : {})
        });
    }

    return index;
}
