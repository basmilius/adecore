import { afterEach, expect, jest, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BackendEvent } from '../backends/types.ts';
import { ProviderRegistry } from '../providers/registry.ts';
import { claudeProvider } from '../testing/providers.ts';
import { AttachmentStore } from './attachment-store.ts';
import { ChatCore } from './chat-core.ts';
import { ChatStore } from './chat-store.ts';

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

async function coreIn(unloadAfterMs?: number, registry: ProviderRegistry = providers): Promise<ChatCore> {
    const home = await mkdtemp(join(tmpdir(), 'adecore-unload-'));
    homes.push(home);
    const attachments = new AttachmentStore(home);

    return new ChatCore({
        attachments,
        store: new ChatStore(home, { attachments }),
        providers: registry,
        ...(unloadAfterMs === undefined ? {} : { unloadAfterMs })
    });
}

/* A provider whose backend is a process: it has a pid until it is disposed, and the test says what it emits. */
function withProcess() {
    const run = { sent: 0, disposed: 0, emit: (_event: BackendEvent): void => undefined };
    const registry = new ProviderRegistry({
        detect: async () => ({ installed: true, version: 'test' }),
        providers: [
            {
                ...claudeProvider,
                createBackend: (_launch, host) => {
                    let pid: number | null = 4242;
                    run.emit = host.onEvent;

                    return {
                        running: true,
                        get pid() {
                            return pid;
                        },
                        start: async () => undefined,
                        sendTurn: () => {
                            run.sent += 1;
                        },
                        compact: () => undefined,
                        interrupt: () => undefined,
                        respondApproval: () => false,
                        respondQuestion: () => false,
                        stop: () => undefined,
                        dispose: async () => {
                            pid = null;
                            run.disposed += 1;
                        }
                    };
                }
            }
        ]
    });

    return { run, registry };
}

/* A turn reaches its CLI once the chat's record is written and the start settled. */
async function sent(core: ChatCore, run: { sent: number }): Promise<void> {
    await core.persisted('chat');

    for (let i = 0; i < 100 && run.sent === 0; i++) {
        await Promise.resolve();
    }
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

test('a chat stays in memory while it holds a preamble that is asked again, since no record keeps one', async () => {
    const core = await coreIn();
    await core.create({ chatId: 'chat', cwd: tmpdir() });
    let waits = true;
    await core.deliverNote('chat', { noteId: 'waiting', note: 'A child waits', preamble: 'A child waits', holds: () => waits });

    expect(await core.unloadIdle('chat')).toBe(false);

    waits = false;

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

test('an idle chat nobody reads ends its CLI when it leaves memory, and not while its turn runs', async () => {
    const { run, registry } = withProcess();
    const core = await coreIn(undefined, registry);
    await core.create({ chatId: 'chat', cwd: tmpdir() });
    await core.send('chat', 'hello');
    await sent(core, run);

    expect(await core.unloadIdle('chat')).toBe(false);
    expect(run.disposed).toBe(0);

    run.emit({ type: 'turn.done', state: 'done', costUsd: 0 });

    expect(await core.unloadIdle('chat')).toBe(true);
    expect(run.disposed).toBe(1);
    expect(core.list()).toMatchObject([{ chatId: 'chat', running: false, status: 'idle' }]);

    await core.shutdown();
});

test('releasing the process of an idle chat ends its CLI and keeps the chat, and a running turn keeps its CLI', async () => {
    const { run, registry } = withProcess();
    const core = await coreIn(undefined, registry);
    await core.create({ chatId: 'chat', cwd: tmpdir() });
    await core.send('chat', 'hello');
    await sent(core, run);

    expect(await core.releaseProcess('chat')).toBe(false);

    run.emit({ type: 'turn.done', state: 'done', costUsd: 0 });

    expect(await core.releaseProcess('chat')).toBe(true);
    expect(run.disposed).toBe(1);
    expect(core.get('chat')?.info).toMatchObject({ running: false, status: 'idle' });
    expect(await core.releaseProcess('chat')).toBe(false);

    await core.shutdown();
});
