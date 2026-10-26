import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ChatVisual } from '@adecore/agent-contracts';
import { ChatCore } from './chat-core.ts';
import { ChatStore } from './chat-store.ts';
import { AttachmentStore } from './attachment-store.ts';
import { BookmarkStore } from './bookmark-store.ts';
import { VisualStore } from './visual-store.ts';
import { claudeProvider } from '../providers/claude-provider.ts';
import { ProviderRegistry } from '../providers/registry.ts';

const providers = new ProviderRegistry({
    detect: async () => ({ installed: true, version: 'test' }),
    providers: [
        {
            ...claudeProvider,
            createBackend: () => ({
                running: true,
                pid: null,
                start: async () => undefined,
                sendTurn: () => undefined,
                compact: () => undefined,
                interrupt: () => undefined,
                respondApproval: () => false,
                respondQuestion: () => false,
                stop: () => undefined,
                dispose: async () => undefined
            })
        }
    ]
});

/* Visuals that answer only when the test says so, so a bookmark can change while they are on their way. */
class SlowVisuals extends VisualStore {
    private readonly released = Promise.withResolvers<void>();
    private readonly asked = Promise.withResolvers<void>();

    /* Resolves once an attach is waiting on the visuals. */
    reading(): Promise<void> {
        return this.asked.promise;
    }

    release(): void {
        this.released.resolve();
    }

    override async list(chatId: string): Promise<ChatVisual[]> {
        this.asked.resolve();
        await this.released.promise;

        return super.list(chatId);
    }
}

test('a client attaches to a chat on disk that nobody loaded since the host started', async () => {
    const home = await mkdtemp(join(tmpdir(), 'adecore-attach-'));
    const attachments = new AttachmentStore(home);
    const before = new ChatCore({ attachments, store: new ChatStore(home, { attachments }), providers });
    const after = new ChatCore({ attachments, store: new ChatStore(home, { attachments }), providers });

    try {
        await before.create({ chatId: 'chat', cwd: home });
        await before.addNote('chat', 'info', 'Written before the restart');
        await before.persisted('chat');
        await before.shutdown();
        const attached = await after.attachWithBookmarks('chat', 'client');
        expect(attached.items.map((item) => (item.kind === 'note' ? item.text : item.kind))).toEqual(['Written before the restart']);
        await expect(after.attachWithBookmarks('never', 'client')).rejects.toThrow('No chat never');
    } finally {
        await after.shutdown();
        await rm(home, { recursive: true, force: true });
    }
});

test('a bookmark made while the visuals are read reaches the client that attaches', async () => {
    const home = await mkdtemp(join(tmpdir(), 'adecore-attach-'));
    const attachments = new AttachmentStore(home);
    const bookmarks = new BookmarkStore(home);
    const visuals = new SlowVisuals(home, attachments);
    const manager = new ChatCore({ attachments, store: new ChatStore(home, { attachments }), providers, bookmarks, visuals });
    const told: string[][] = [];

    try {
        await manager.create({ chatId: 'chat', cwd: home });

        manager.subscribe('client', (event) => {
            if (event.event === 'chat.bookmarks') {
                told.push(event.payload.bookmarks.map((bookmark) => bookmark.itemId));
            }
        });

        const attaching = manager.attachWithBookmarks('chat', 'client');
        await visuals.reading();
        await bookmarks.add('chat', { itemId: 'late', excerpt: 'Late' }, 1);
        visuals.release();
        const attached = await attaching;
        const seen = told.at(-1) ?? attached.bookmarks?.map((bookmark) => bookmark.itemId);
        expect(seen).toEqual(['late']);
    } finally {
        await manager.shutdown();
        await rm(home, { recursive: true, force: true });
    }
});
