import { createHash } from 'node:crypto';
import { constants, copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gunzip, gzip, gzipSync } from 'node:zlib';
import { CHAT_PAYLOAD_INLINE_BYTES, ChatCheckpointDiffSchema, type ChatCheckpointDiff, type ChatItem, type ChatPayloadRef } from '@adecore/agent-contracts';
import { isNotFound, writeAtomic, writeAtomicSync } from '../fs.ts';
import { ChatError } from './errors.ts';

/* How much of a value stored apart the item keeps: what a timeline shows before anyone asks for the rest. */
export const PAYLOAD_PREVIEW_BYTES = 8 * 1024;

const FOLDER_SUFFIX = '.payloads';
const ID_PATTERN = /^[0-9a-f]{64}$/;
const CONTINUATION_MASK = 0xc0;
const CONTINUATION = 0x80;

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/* What a thread needs on disk beside its record: each payload by id, with its text when this process still holds it. */
export type PayloadSources = Map<string, (() => string) | null>;

export interface CompactedItems {
    items: ChatItem[];
    payloads: PayloadSources;
}

interface Compacted {
    item: ChatItem;
    payloads: [string, (() => string) | null][];
}

// Items never change in place, so an item compacted once answers the same for every write of every chat after it.
const compactedItems = new WeakMap<ChatItem, Compacted>();

/* The folder of a chat's payloads beside its record, which `ChatStore.list` passes over since it is no JSON. */
export function payloadFolderName(chatId: string): string {
    return `${encodeURIComponent(chatId)}${FOLDER_SUFFIX}`;
}

function payloadId(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

function byteLength(text: string): number {
    return Buffer.byteLength(text, 'utf8');
}

/* Whether a text is past the inline limit, without encoding the short ones: a UTF-16 unit is at most three bytes. */
function pastInline(text: string): boolean {
    return text.length * 3 > CHAT_PAYLOAD_INLINE_BYTES && byteLength(text) > CHAT_PAYLOAD_INLINE_BYTES;
}

/*
 * The beginning of a text in at most `maxBytes` of UTF-8, never cut inside a character, and cut after
 * the last line break when that keeps at least half of it, so a preview ends on a whole line.
 */
export function previewOf(text: string, maxBytes: number): string {
    let units = Math.min(text.length, maxBytes);

    // Half a surrogate pair would encode as a replacement character.
    if (units < text.length && isHighSurrogate(text.charCodeAt(units - 1))) {
        units -= 1;
    }

    const head = Buffer.from(text.slice(0, units), 'utf8');
    let end = Math.min(head.length, maxBytes);

    while (end > 0 && end < head.length && (head[end]! & CONTINUATION_MASK) === CONTINUATION) {
        end -= 1;
    }

    const prefix = head.subarray(0, end).toString('utf8');

    if (prefix.length === text.length) {
        return text;
    }

    const lineEnd = prefix.lastIndexOf('\n');

    return lineEnd >= prefix.length / 2 ? prefix.slice(0, lineEnd + 1) : prefix;
}

function isHighSurrogate(code: number): boolean {
    return code >= 0xd800 && code <= 0xdbff;
}

/* Every file of a diff, with the diffs that fit the preview in order and the rest held back as empty. */
function diffPreview(diff: ChatCheckpointDiff): ChatCheckpointDiff {
    let budget = PAYLOAD_PREVIEW_BYTES;

    const files = diff.files.map((file) => {
        const size = byteLength(file.diff);

        if (size <= budget) {
            budget -= size;

            return file;
        }

        budget = 0;

        return { ...file, diff: '' };
    });

    return { ...diff, files };
}

function compactOne(item: ChatItem): Compacted {
    if (item.kind === 'tool') {
        if (item.outputRef) {
            return { item, payloads: [[item.outputRef.id, null]] };
        }

        const output = item.output;

        if (output === null || !pastInline(output)) {
            return { item, payloads: [] };
        }

        const ref: ChatPayloadRef = { id: payloadId(output), bytes: byteLength(output) };

        return { item: { ...item, output: previewOf(output, PAYLOAD_PREVIEW_BYTES), outputRef: ref }, payloads: [[ref.id, () => output]] };
    }

    if (item.kind === 'turn' && item.checkpointDiff) {
        if (item.checkpointDiffRef) {
            return { item, payloads: [[item.checkpointDiffRef.id, null]] };
        }

        const json = JSON.stringify(item.checkpointDiff);

        if (!pastInline(json)) {
            return { item, payloads: [] };
        }

        const ref: ChatPayloadRef = { id: payloadId(json), bytes: byteLength(json) };
        const diff = item.checkpointDiff;

        return { item: { ...item, checkpointDiff: diffPreview(diff), checkpointDiffRef: ref }, payloads: [[ref.id, () => JSON.stringify(diff)]] };
    }

    return { item, payloads: [] };
}

/*
 * A thread with every output and diff past the inline limit cut to its beginning, and what has to be
 * on disk for the rest. A payload is named by the hash of its text, so the same text written twice, or
 * copied in from another chat, is one file.
 */
export function compactItems(items: readonly ChatItem[]): CompactedItems {
    const payloads: PayloadSources = new Map();

    const compacted = items.map((item) => {
        let known = compactedItems.get(item);

        if (known === undefined) {
            known = compactOne(item);
            compactedItems.set(item, known);
        }

        for (const [id, source] of known.payloads) {
            if (source !== null || !payloads.has(id)) {
                payloads.set(id, source);
            }
        }

        return known.item;
    });

    return { items: compacted, payloads };
}

/* The payloads a thread refers to, by the refs its items carry. */
export function payloadRefsOf(items: readonly ChatItem[]): Set<string> {
    const ids = new Set<string>();

    for (const item of items) {
        if (item.kind === 'tool' && item.outputRef) {
            ids.add(item.outputRef.id);
        } else if (item.kind === 'turn' && item.checkpointDiffRef) {
            ids.add(item.checkpointDiffRef.id);
        }
    }

    return ids;
}

/*
 * The outputs and diffs of every chat that are too large to keep in its record, one gzip file per
 * payload under `<chats>/<chat id>.payloads/<sha-256>.gz`. Each chat has its own folder, so removing
 * a chat never reaches into a fork that copied from it.
 */
export class PayloadStore {
    private readonly dir: string;
    // What this process knows is on disk per chat, so a write checks a payload once and not every time.
    private readonly present = new Map<string, Set<string>>();
    // What was written while a prune ran, which that prune must not take away again.
    private readonly writtenDuringPrune = new Map<string, Set<string>>();

    constructor(dir: string) {
        this.dir = dir;
    }

    folder(chatId: string): string {
        return join(this.dir, payloadFolderName(chatId));
    }

    /* Puts every payload on disk that is not there yet: from its text, or copied from another chat that has it. */
    async ensure(chatId: string, payloads: PayloadSources): Promise<void> {
        const present = this.presentIn(chatId);
        const folder = this.folder(chatId);
        let others: string[] | null = null;

        for (const [id, source] of payloads) {
            if (present.has(id)) {
                continue;
            }

            const path = join(folder, `${id}.gz`);

            if (await existsAsync(path)) {
                this.mark(chatId, id);

                continue;
            }

            await mkdir(folder, { recursive: true, mode: 0o700 });

            if (source !== null) {
                await writeAtomic(path, await gzipAsync(source()));
                this.mark(chatId, id);

                continue;
            }

            others ??= await this.otherFolders(chatId);

            if (await copyFromAny(others, id, path)) {
                this.mark(chatId, id);
            }
        }
    }

    /* `ensure` without a turn of the event loop, for a write on the way out. */
    ensureSync(chatId: string, payloads: PayloadSources): void {
        const present = this.presentIn(chatId);
        const folder = this.folder(chatId);
        let others: string[] | null = null;

        for (const [id, source] of payloads) {
            if (present.has(id)) {
                continue;
            }

            const path = join(folder, `${id}.gz`);

            if (existsSync(path)) {
                this.mark(chatId, id);

                continue;
            }

            mkdirSync(folder, { recursive: true, mode: 0o700 });

            if (source !== null) {
                writeAtomicSync(path, gzipSync(source()));
                this.mark(chatId, id);

                continue;
            }

            others ??= this.otherFoldersSync(chatId);

            if (copyFromAnySync(others, id, path)) {
                this.mark(chatId, id);
            }
        }
    }

    async read(chatId: string, id: string): Promise<string> {
        if (!ID_PATTERN.test(id)) {
            throw new ChatError('payload-missing', `No stored payload ${id} in chat ${chatId}`);
        }

        let packed: Buffer;

        try {
            packed = await readFile(join(this.folder(chatId), `${id}.gz`));
        } catch (e) {
            if (isNotFound(e)) {
                throw new ChatError('payload-missing', `The stored payload ${id} of chat ${chatId} is gone`);
            }

            throw e;
        }

        return (await gunzipAsync(packed)).toString('utf8');
    }

    async readDiff(chatId: string, id: string): Promise<ChatCheckpointDiff> {
        const parsed = ChatCheckpointDiffSchema.safeParse(JSON.parse(await this.read(chatId, id)));

        if (!parsed.success) {
            throw new ChatError('payload-missing', `The stored diff ${id} of chat ${chatId} does not read`);
        }

        return parsed.data;
    }

    /* Removes the payloads of a chat its thread no longer refers to, such as everything before a clear. */
    async prune(chatId: string, keep: ReadonlySet<string>): Promise<void> {
        const folder = this.folder(chatId);
        let names: string[];

        try {
            names = await readdir(folder);
        } catch (e) {
            if (isNotFound(e)) {
                return;
            }

            throw e;
        }

        const written = new Set<string>();
        this.writtenDuringPrune.set(chatId, written);

        try {
            for (const name of names) {
                const id = name.replace(/\.gz$/, '');

                if (keep.has(id) || written.has(id)) {
                    continue;
                }

                this.present.get(chatId)?.delete(id);
                await rm(join(folder, name), { force: true });
            }
        } finally {
            this.writtenDuringPrune.delete(chatId);
        }
    }

    async remove(chatId: string): Promise<void> {
        this.present.delete(chatId);
        await rm(this.folder(chatId), { recursive: true, force: true });
    }

    private presentIn(chatId: string): Set<string> {
        let present = this.present.get(chatId);

        if (!present) {
            present = new Set();
            this.present.set(chatId, present);
        }

        return present;
    }

    private mark(chatId: string, id: string): void {
        this.presentIn(chatId).add(id);
        this.writtenDuringPrune.get(chatId)?.add(id);
    }

    private async otherFolders(chatId: string): Promise<string[]> {
        try {
            return foldersOf(this.dir, await readdir(this.dir), chatId);
        } catch (e) {
            if (isNotFound(e)) {
                return [];
            }

            throw e;
        }
    }

    private otherFoldersSync(chatId: string): string[] {
        try {
            return foldersOf(this.dir, readdirSync(this.dir), chatId);
        } catch (e) {
            if (isNotFound(e)) {
                return [];
            }

            throw e;
        }
    }
}

function foldersOf(dir: string, names: readonly string[], chatId: string): string[] {
    const own = payloadFolderName(chatId);

    return names.filter((name) => name.endsWith(FOLDER_SUFFIX) && name !== own).map((name) => join(dir, name));
}

// A clone where the file system has one, so a fork of a large chat takes no space until either side changes.
const COPY_MODE = constants.COPYFILE_FICLONE;

async function copyFromAny(folders: readonly string[], id: string, target: string): Promise<boolean> {
    for (const folder of folders) {
        try {
            await copyFile(join(folder, `${id}.gz`), target, COPY_MODE);

            return true;
        } catch (e) {
            if (!isNotFound(e)) {
                throw e;
            }
        }
    }

    return false;
}

function copyFromAnySync(folders: readonly string[], id: string, target: string): boolean {
    for (const folder of folders) {
        try {
            copyFileSync(join(folder, `${id}.gz`), target, COPY_MODE);

            return true;
        } catch (e) {
            if (!isNotFound(e)) {
                throw e;
            }
        }
    }

    return false;
}

async function existsAsync(path: string): Promise<boolean> {
    try {
        await stat(path);

        return true;
    } catch (e) {
        if (isNotFound(e)) {
            return false;
        }

        throw e;
    }
}

function existsSync(path: string): boolean {
    try {
        statSync(path);

        return true;
    } catch (e) {
        if (isNotFound(e)) {
            return false;
        }

        throw e;
    }
}
