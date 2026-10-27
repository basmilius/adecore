import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChatCheckpointDiff, ChatInfo, ChatToolItem, ChatTurnItem } from '@adecore/agent-contracts';
import { claudeProvider } from '../providers/claude-provider.ts';
import { ProviderRegistry } from '../providers/registry.ts';
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

const OUTPUT = Array.from({ length: 4000 }, (_, index) => `line ${index} of a long build log`).join('\n');

const DIFF: ChatCheckpointDiff = {
    files: Array.from({ length: 40 }, (_, index) => ({
        path: `src/f${index}.ts`,
        kind: 'update',
        added: 2,
        deleted: 1,
        diff: `@@ -1 +1,2 @@\n${'+'.repeat(3000)}\n`
    })),
    truncated: false
};

let home: string;
let store: ChatStore;
let core: ChatCore;

function info(chatId: string): ChatInfo {
    return {
        chatId,
        provider: 'claude',
        cwd: home,
        agentSessionId: null,
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

function thread(): [ChatTurnItem, ChatToolItem] {
    return [
        { id: 't1', kind: 'turn', createdAt: 1, turnId: 't1', state: 'done', endedAt: 2, costUsd: 0, checkpoint: 'tree', checkpointDiff: DIFF },
        {
            id: 'tool',
            kind: 'tool',
            createdAt: 1,
            turnId: 't1',
            toolUseId: 'tool',
            name: 'Bash',
            input: {},
            output: OUTPUT,
            state: 'done',
            parentToolUseId: null
        }
    ];
}

function payloads(chatId: string): Promise<string[]> {
    return readdir(join(store.dir, `${chatId}.payloads`)).catch(() => []);
}

beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'adecore-core-payloads-'));
    const attachments = new AttachmentStore(home);
    store = new ChatStore(home, { attachments });
    core = new ChatCore({ attachments, store, providers });
    await store.write('chat', info('chat'), thread());
});

afterEach(async () => {
    await core.shutdown();
    await rm(home, { recursive: true, force: true });
});

test('an attach carries the beginning of a large output and diff, and the whole comes on request', async () => {
    await core.create({ chatId: 'chat' });
    const { items } = await core.attachWithBookmarks('chat', 'client');
    const [turn, tool] = items as [ChatTurnItem, ChatToolItem];

    expect(tool.output?.length).toBeLessThan(OUTPUT.length);
    expect(tool.outputRef?.bytes).toBe(OUTPUT.length);
    expect(turn.checkpointDiff?.files).toHaveLength(DIFF.files.length);
    expect(turn.checkpointDiffRef).toBeDefined();
    expect(await core.toolOutput('chat', 'tool')).toBe(OUTPUT);
    expect(await core.turnDiff('chat', 't1')).toEqual(DIFF);
    await expect(core.toolOutput('chat', 't1')).rejects.toMatchObject({ code: 'item-not-found' });
});

test('a clear takes the payloads of the thread it emptied along', async () => {
    await core.create({ chatId: 'chat' });

    expect(await payloads('chat')).toHaveLength(2);

    await core.clear('chat');

    expect(await payloads('chat')).toEqual([]);
});

test('a fork keeps its payloads when the chat it came from is removed', async () => {
    const items = (await core.readChat('chat'))?.items ?? [];
    await core.writeRecord('fork', info('fork'), items);

    expect(await core.deleteRecord('chat')).toBe(true);
    expect(await payloads('chat')).toEqual([]);

    await core.create({ chatId: 'fork' });

    expect(await core.toolOutput('fork', 'tool')).toBe(OUTPUT);
    expect(await core.turnDiff('fork', 't1')).toEqual(DIFF);
});

test('removing a loaded chat removes its payloads', async () => {
    await core.create({ chatId: 'chat' });
    await core.kill('chat');

    expect(await payloads('chat')).toEqual([]);
});
