import { afterEach, expect, jest, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ChatCore } from './chat-core.ts';
import { ChatStore } from './chat-store.ts';
import { AttachmentStore } from './attachment-store.ts';
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

const homes: string[] = [];

async function coreIn(unloadAfterMs?: number): Promise<ChatCore> {
    const home = await mkdtemp(join(tmpdir(), 'adecore-unload-'));
    homes.push(home);
    const attachments = new AttachmentStore(home);

    return new ChatCore({ attachments, store: new ChatStore(home, { attachments }), providers, ...(unloadAfterMs === undefined ? {} : { unloadAfterMs }) });
}

function notes(items: { kind: string; text?: string }[]): string[] {
    return items.map((item) => (item.kind === 'note' ? (item.text ?? '') : item.kind));
}

afterEach(async () => {
    jest.useRealTimers();
    await Promise.all(homes.splice(0).map((home) => rm(home, { recursive: true, force: true })));
});

test('an idle chat nobody reads leaves memory, stays listed and loads again from its record', async () => {
    const core = await coreIn();
    await core.create({ chatId: 'chat', cwd: tmpdir() });
    await core.addNote('chat', 'info', 'Written before it left');

    expect(await core.unloadIdle('chat')).toBe(true);
    expect(core.get('chat')).toBeUndefined();
    expect(core.list().map((info) => info.chatId)).toEqual(['chat']);

    const attached = await core.attachWithBookmarks('chat', 'client');

    expect(notes(attached.items)).toEqual(['Written before it left']);
    expect(core.get('chat')).toBeDefined();
    expect(core.list().map((info) => info.chatId)).toEqual(['chat']);

    await core.shutdown();
});

test('a chat a client reads stays in memory until the client leaves', async () => {
    const core = await coreIn();
    await core.create({ chatId: 'chat', cwd: tmpdir() });
    core.attach('chat', 'client');

    expect(await core.unloadIdle('chat')).toBe(false);
    expect(core.get('chat')).toBeDefined();

    core.detach('chat', 'client');

    expect(await core.unloadIdle('chat')).toBe(true);

    await core.shutdown();
});

test('a chat a person holds stays in memory', async () => {
    const core = await coreIn();
    await core.create({ chatId: 'chat', cwd: tmpdir() });
    core.holdForPerson('chat', 'card');

    expect(await core.unloadIdle('chat')).toBe(false);

    core.releaseHold('chat', 'card');

    expect(await core.unloadIdle('chat')).toBe(true);

    await core.shutdown();
});

test('a chat leaves by itself once nobody read it for unloadAfterMs, and a client that comes back in time keeps it', async () => {
    jest.useFakeTimers();
    const core = await coreIn(60_000);
    await core.create({ chatId: 'chat', cwd: tmpdir() });
    core.attach('chat', 'client');
    jest.advanceTimersByTime(120_000);

    expect(core.get('chat')).toBeDefined();

    core.detach('chat', 'client');
    jest.advanceTimersByTime(30_000);
    core.attach('chat', 'client');
    core.detach('chat', 'client');
    jest.advanceTimersByTime(59_999);

    expect(core.get('chat')).toBeDefined();

    jest.advanceTimersByTime(1);
    await core.persisted('chat');
    await Promise.resolve();

    expect(core.get('chat')).toBeUndefined();

    await core.shutdown();
});

test('removing the record of a chat that left memory takes it off the list', async () => {
    const core = await coreIn();
    await core.create({ chatId: 'chat', cwd: tmpdir() });
    await core.unloadIdle('chat');

    expect(await core.deleteRecord('chat')).toBe(true);
    expect(core.list()).toEqual([]);

    await core.shutdown();
});
