import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChatInfo } from '@adecore/agent-contracts';
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

let home: string;
let store: ChatStore;
let core: ChatCore;

function info(chatId: string, agentSessionId: string | null): ChatInfo {
    return {
        chatId,
        provider: 'claude',
        cwd: home,
        agentSessionId,
        model: null,
        selection: { model: 'claude-sonnet-5', options: {} },
        runtimeMode: 'full-access',
        status: 'idle',
        running: false,
        activeTurnId: null,
        slashCommands: [],
        usage: { contextTokens: 0, contextWindow: null, costUsd: 0, turns: 0 },
        createdAt: 0
    };
}

beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'adecore-core-session-id-'));
    const attachments = new AttachmentStore(home);
    store = new ChatStore(home, { attachments });
    core = new ChatCore({ attachments, store, providers });
});

afterEach(async () => {
    await core.shutdown();
    await rm(home, { recursive: true, force: true });
});

test('tells the agent session of a stored chat without reading its thread, and of one in memory from memory', async () => {
    await store.write('stored', info('stored', 'session-1'), []);
    await store.write('open', info('open', 'session-2'), []);
    await core.create({ chatId: 'open' });
    const read = spyOn(store, 'read');

    expect(await core.agentSessionIdOf('stored')).toBe('session-1');
    expect(await core.agentSessionIdOf('open')).toBe('session-2');
    expect(read).not.toHaveBeenCalled();

    read.mockRestore();
});

test('reads the whole record when its head does not say', async () => {
    await mkdir(store.dir, { recursive: true });
    await writeFile(join(store.dir, 'odd.json'), JSON.stringify({ items: [], info: info('odd', 'session-3') }));
    const read = spyOn(store, 'read');

    expect(await core.agentSessionIdOf('odd')).toBe('session-3');
    expect(read).toHaveBeenCalledWith('odd');
    expect(await core.agentSessionIdOf('missing')).toBeNull();

    read.mockRestore();
});
