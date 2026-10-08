import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ChatVisualsSchema, injectVisualBootstrap, VISUAL_LIMITS, type ChatAttachment, type ChatVisual, type VisualHeight } from '@adecore/agent-contracts';
import { z } from 'zod';
import { isNotFound, writeAtomic } from '../fs.ts';
import { KeyedSerializer } from '../serializer.ts';
import type { AttachmentStore } from './attachment-store.ts';
import { ChatError } from './errors.ts';

const SUFFIX = '.visuals.json';

const VisualFileSchema = z.object({ version: z.literal(1), visuals: ChatVisualsSchema });

export function visualFileName(chatId: string): string {
    return `${encodeURIComponent(chatId)}${SUFFIX}`;
}

/* Whether a name in the chats folder is a visuals file, which the chat records beside it must not count as a chat. */
export function isVisualFileName(name: string): boolean {
    return name.endsWith(SUFFIX);
}

/* What an agent hands over: the page as it wrote it, which gets its bootstrap here. */
export interface VisualInput {
    title: string;
    html: string;
    // CSS pixels; absent, the largest a frame may be.
    maxHeight?: number;
    // `[width, height]` in CSS pixels, from a host that measured the page before publishing it.
    heights?: ReadonlyArray<readonly [number, number]>;
    turnId?: string;
}

export interface VisualStoreOptions {
    // The clock `at` is stamped with, which has to be the one the thread's `createdAt` comes from.
    now?: () => number;
}

export type VisualListener = (chatId: string, visuals: ChatVisual[]) => void;

const MIB = 1024 * 1024;

function mebibytes(bytes: number): string {
    return `${(bytes / MIB).toFixed(1)} MiB`;
}

function refuse(code: 'visual-invalid' | 'visual-too-large', message: string): never {
    throw new ChatError(code, message);
}

function isSize(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/* The input as it is kept, or a refusal that tells the agent what to change. */
function checked(input: VisualInput): { title: string; html: string; maxHeight: number; heights: VisualHeight[] | undefined } {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (title === '') {
        refuse('visual-invalid', 'A visual needs a title; give it a short one that says what the page shows');
    }
    if (title.length > VISUAL_LIMITS.title) {
        refuse('visual-invalid', `The title has ${title.length} characters; keep it to ${VISUAL_LIMITS.title} or fewer`);
    }
    if (typeof input.html !== 'string' || input.html.trim() === '') {
        refuse('visual-invalid', 'The page is empty; pass one self-contained HTML document');
    }
    const maxHeight = input.maxHeight ?? VISUAL_LIMITS.maxHeight;
    if (!isSize(maxHeight) || maxHeight < VISUAL_LIMITS.minHeight || maxHeight > VISUAL_LIMITS.maxHeight) {
        refuse(
            'visual-invalid',
            `The maximum height must be from ${VISUAL_LIMITS.minHeight} to ${VISUAL_LIMITS.maxHeight} CSS pixels; leave it out for ${VISUAL_LIMITS.maxHeight}`
        );
    }
    const heights = input.heights ?? [];
    if (
        !Array.isArray(heights) ||
        heights.length > VISUAL_LIMITS.heights ||
        heights.some((pair) => !Array.isArray(pair) || !isSize(pair[0]) || !isSize(pair[1]) || pair[0] <= 0 || pair[1] < 0)
    ) {
        refuse('visual-invalid', `Measured heights are at most ${VISUAL_LIMITS.heights} pairs of [width, height] in CSS pixels, with a positive width`);
    }
    // One measurement per width, the last one given, ascending as `visualFrameHeight` reads them.
    const byWidth = new Map(heights.map((pair): [number, number] => [Math.max(1, Math.round(pair[0])), Math.ceil(pair[1])]));
    const sorted = [...byWidth].sort((a, b) => a[0] - b[0]);
    return { title, html: input.html, maxHeight: Math.round(maxHeight), heights: sorted.length === 0 ? undefined : sorted };
}

function tooLarge(bytes: number): never {
    return refuse(
        'visual-too-large',
        `The page is ${mebibytes(bytes)} and a visual may be at most ${mebibytes(VISUAL_LIMITS.bytes)}; ` +
            'load libraries from a public CDN URL and refer to large images by their http(s) URL instead of inlining them'
    );
}

/*
 * The visuals of every chat. The list of a chat is one file beside its record under `<home>/chats`;
 * each page is a file in the chat's attachment folder, `<id>.html`, so whatever serves an attachment
 * serves a page by its id unchanged. One chain per chat puts a publish and a removal after each other,
 * and every change is told to the listeners from inside that chain.
 */
export class VisualStore {
    readonly dir: string;
    private readonly attachments: AttachmentStore;
    private readonly now: () => number;
    private readonly writes = new KeyedSerializer();
    private readonly listeners = new Set<VisualListener>();
    // The lists last read or written, so an attachment lookup, which cannot wait, finds a page.
    private readonly known = new Map<string, ChatVisual[]>();

    constructor(home: string, attachments: AttachmentStore, options: VisualStoreOptions = {}) {
        this.dir = join(home, 'chats');
        this.attachments = attachments;
        this.now = options.now ?? Date.now;
    }

    listen(listener: VisualListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /* The visuals of one chat in the order they were published, after any write still on its way. */
    list(chatId: string): Promise<ChatVisual[]> {
        return this.writes.run(chatId, () => this.readFile(chatId));
    }

    workspacePath(chatId: string): string {
        return join(this.dir, `${encodeURIComponent(chatId)}.visuals`);
    }

    async prepareWorkspace(chatId: string): Promise<string> {
        const path = this.workspacePath(chatId);
        await mkdir(path, { recursive: true, mode: 0o700 });
        return path;
    }

    // Only a filename is accepted; an agent cannot make the host write outside its own chat.
    async writeSource(chatId: string, name: string, html: string): Promise<string> {
        if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\.html$/.test(name)) {
            refuse('visual-invalid', 'Use an HTML filename such as chart.html, with letters, numbers, dots, hyphens or underscores and no directory');
        }
        if (html.trim() === '') {
            refuse('visual-invalid', 'The page is empty; pass one self-contained HTML document');
        }
        if (Buffer.byteLength(html, 'utf8') > VISUAL_LIMITS.bytes) {
            tooLarge(Buffer.byteLength(html, 'utf8'));
        }
        return this.writeWorkspaceFile(chatId, name, html);
    }

    writePreview(chatId: string, png: Uint8Array): Promise<string> {
        return this.writeWorkspaceFile(chatId, `preview-${randomBytes(8).toString('hex')}.png`, png);
    }

    /* Stores a page with its bootstrap and adds it to the chat at the host's current time. */
    async publish(chatId: string, input: VisualInput): Promise<ChatVisual> {
        const { title, html, maxHeight, heights } = checked(input);
        // Before the bootstrap is added, so a page far too large is never copied first.
        if (Buffer.byteLength(html, 'utf8') > VISUAL_LIMITS.bytes) {
            tooLarge(Buffer.byteLength(html, 'utf8'));
        }
        const page = Buffer.from(injectVisualBootstrap(html), 'utf8');
        if (page.byteLength > VISUAL_LIMITS.bytes) {
            tooLarge(page.byteLength);
        }
        const turnId = typeof input.turnId === 'string' && input.turnId !== '' ? input.turnId : undefined;
        return this.writes.run(chatId, async () => {
            const visuals = await this.readFile(chatId);
            const visual: ChatVisual = {
                id: randomBytes(8).toString('hex'),
                title,
                at: this.now(),
                maxHeight,
                ...(heights === undefined ? {} : { heights }),
                size: page.byteLength,
                ...(turnId === undefined ? {} : { turnId })
            };
            await mkdir(this.attachments.folderOf(chatId), { recursive: true, mode: 0o700 });
            await writeAtomic(this.pagePath(chatId, visual.id), page);
            const next = [...visuals, visual];
            try {
                await this.writeFile(chatId, next);
            } catch (e) {
                await rm(this.pagePath(chatId, visual.id), { force: true });
                throw e;
            }
            this.tell(chatId, next);
            return visual;
        });
    }

    /* Takes a visual and its page away; one that is already gone changes nothing. */
    remove(chatId: string, visualId: string): Promise<ChatVisual[]> {
        return this.writes.run(chatId, async () => {
            const visuals = await this.readFile(chatId);
            if (!visuals.some((visual) => visual.id === visualId)) {
                return visuals;
            }
            const next = visuals.filter((visual) => visual.id !== visualId);
            await this.writeFile(chatId, next);
            await rm(this.pagePath(chatId, visualId), { force: true });
            this.tell(chatId, next);
            return next;
        });
    }

    /* The visuals go with the chat or with a clear of it. A list that no longer parses goes too, since nothing could show it again. */
    removeChat(chatId: string): Promise<void> {
        return this.writes.run(chatId, async () => {
            const visuals = await this.readFile(chatId).catch(() => null);
            await rm(join(this.dir, visualFileName(chatId)), { force: true });
            await rm(this.workspacePath(chatId), { recursive: true, force: true });
            await Promise.all((visuals ?? []).map((visual) => rm(this.pagePath(chatId, visual.id), { force: true })));
            this.known.delete(chatId);
            if (visuals === null || visuals.length > 0) {
                this.tell(chatId, []);
            }
        });
    }

    /*
     * Gives a fork the visuals `keep` picks, every one without it, each with a page of its own, so
     * removing either chat leaves the other's pages where they are. A page that is gone is left out.
     */
    async copyChat(fromChatId: string, toChatId: string, keep: (visual: ChatVisual) => boolean = () => true): Promise<ChatVisual[]> {
        const kept = (await this.list(fromChatId)).filter(keep);
        if (kept.length === 0) {
            return this.list(toChatId);
        }
        return this.writes.run(toChatId, async () => {
            const copied: ChatVisual[] = [];
            await mkdir(this.attachments.folderOf(toChatId), { recursive: true, mode: 0o700 });
            for (const visual of kept) {
                const page = await readFile(this.pagePath(fromChatId, visual.id)).catch((e: unknown) => {
                    if (isNotFound(e)) {
                        return null;
                    }
                    throw e;
                });
                if (page !== null) {
                    await writeAtomic(this.pagePath(toChatId, visual.id), page);
                    copied.push(visual);
                }
            }
            const existing = await this.readFile(toChatId);
            const ids = new Set(existing.map((visual) => visual.id));
            const next = [...existing, ...copied.filter((visual) => !ids.has(visual.id))];
            await this.writeFile(toChatId, next);
            this.tell(toChatId, next);
            return next;
        });
    }

    /* A page as an attachment of its chat, from the lists this store has seen; null for one it does not know. */
    attachment(chatId: string, visualId: string): ChatAttachment | null {
        const visual = this.known.get(chatId)?.find((candidate) => candidate.id === visualId);
        if (!visual) {
            return null;
        }
        return { id: visual.id, name: `${visual.title}.html`, mime: 'text/html', size: visual.size, path: this.pagePath(chatId, visual.id) };
    }

    pagePath(chatId: string, visualId: string): string {
        return join(this.attachments.folderOf(chatId), `${visualId}.html`);
    }

    private writeWorkspaceFile(chatId: string, name: string, content: string | Uint8Array): Promise<string> {
        return this.writes.run(chatId, async () => {
            const path = join(await this.prepareWorkspace(chatId), name);
            await writeAtomic(path, content);
            return path;
        });
    }

    private tell(chatId: string, visuals: ChatVisual[]): void {
        for (const listener of this.listeners) {
            listener(chatId, visuals);
        }
    }

    private async readFile(chatId: string): Promise<ChatVisual[]> {
        let raw: string;
        try {
            raw = await readFile(join(this.dir, visualFileName(chatId)), 'utf8');
        } catch (e) {
            if (isNotFound(e)) {
                this.known.delete(chatId);
                return [];
            }
            throw e;
        }
        // A file that does not parse is refused rather than read as empty, which the next write would make true.
        const parsed = VisualFileSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
            throw new Error(`The visuals file of chat ${chatId} is not valid: ${parsed.error.issues[0]?.message ?? 'unknown problem'}`);
        }
        this.known.set(chatId, parsed.data.visuals);
        return parsed.data.visuals;
    }

    private async writeFile(chatId: string, visuals: readonly ChatVisual[]): Promise<void> {
        const path = join(this.dir, visualFileName(chatId));
        if (visuals.length === 0) {
            await rm(path, { force: true });
            this.known.delete(chatId);
            return;
        }
        await mkdir(this.dir, { recursive: true, mode: 0o700 });
        await writeAtomic(path, JSON.stringify({ version: 1, visuals }));
        this.known.set(chatId, [...visuals]);
    }
}
