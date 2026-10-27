import { UsageProviderSchema, type UsageProvider } from '@adecore/agent-contracts';
import type { CodexParserState } from './readers/codex.ts';

const STATE_VERSION = 1;

/* Where the scanner left a transcript. All of it can be rebuilt by reading the transcript again. */
export interface ScanState {
    provider: UsageProvider;
    size: number;
    mtimeMs: number;
    /* Just past the last newline that was read, so a file that grew is read from there. */
    offset: number;
    /* What the reader has to remember to carry on halfway through a Codex file. */
    codex: CodexParserState | null;
    /* A versioned hash of all bytes before the offset; absent where an append cannot be verified. */
    head: string | null;
    parserVersion?: number;
    compressed?: boolean;
}

/* The history this state was saved against: the rewrite it belongs to and how far into it. */
export interface HistoryMark {
    gen: string;
    bytes: number;
}

interface StateRow {
    p: UsageProvider;
    s: number;
    m: number;
    o: number;
    c: CodexParserState | null;
    h?: string;
    v?: number;
    z?: boolean;
}

interface StateFile {
    version: number;
    history: HistoryMark;
    files: Record<string, StateRow>;
}

export function encodeState(state: ReadonlyMap<string, ScanState>, history: HistoryMark): string {
    const files: Record<string, StateRow> = {};

    for (const [path, file] of state) {
        files[path] = {
            p: file.provider,
            s: file.size,
            m: file.mtimeMs,
            o: file.offset,
            c: file.codex,
            ...(file.head === null ? {} : { h: file.head }),
            ...(file.parserVersion === undefined ? {} : { v: file.parserVersion }),
            ...(file.compressed === undefined ? {} : { z: file.compressed })
        };
    }

    const document: StateFile = { version: STATE_VERSION, history, files };

    return JSON.stringify(document);
}

/* Null for text that is no state of this version; an entry that does not read only costs a read of its transcript. */
export function decodeState(text: string): { history: HistoryMark; files: Map<string, ScanState> } | null {
    let document: Partial<StateFile> | null;

    try {
        document = JSON.parse(text) as Partial<StateFile> | null;
    } catch {
        return null;
    }

    const history = document?.history;

    if (document?.version !== STATE_VERSION || typeof history?.gen !== 'string' || typeof history.bytes !== 'number') {
        return null;
    }

    const files = new Map<string, ScanState>();

    for (const [path, file] of Object.entries(document.files ?? {})) {
        if (!UsageProviderSchema.safeParse(file.p).success) {
            continue;
        }

        if (typeof file.s !== 'number' || typeof file.m !== 'number' || typeof file.o !== 'number' || file.o < 0) {
            continue;
        }

        files.set(path, {
            provider: file.p,
            size: file.s,
            mtimeMs: file.m,
            offset: file.o,
            codex: file.c ?? null,
            head: typeof file.h === 'string' ? file.h : null,
            ...(typeof file.v === 'number' ? { parserVersion: file.v } : {}),
            ...(typeof file.z === 'boolean' ? { compressed: file.z } : {})
        });
    }

    return { history: { gen: history.gen, bytes: history.bytes }, files };
}
