import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HOST_TASK_ORIGIN, type ChatSubagentItem } from '@adecore/agent-contracts';
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
                running: false,
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

function taskRow(childId = 'child'): ChatSubagentItem {
    return {
        id: 'task-one',
        kind: 'subagent',
        createdAt: 1,
        turnId: null,
        toolUseId: 'task-one',
        description: 'Read the files',
        subagentType: null,
        prompt: null,
        background: true,
        status: 'running',
        startedAt: 1,
        finishedAt: null,
        summary: null,
        result: null,
        usage: null,
        lastTool: null,
        itemsTruncated: false,
        origin: HOST_TASK_ORIGIN,
        childId
    };
}

let home: string;
let core: ChatCore;

beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'adecore-task-children-'));
    core = new ChatCore({ providers, store: new ChatStore(home), attachments: new AttachmentStore(home) });
    await core.create({ chatId: 'parent', provider: 'claude', cwd: home });
    await core.create({ chatId: 'child', provider: 'claude', cwd: home });
    core.get('parent')!.upsertItems([taskRow()]);
});

afterEach(async () => {
    await core.shutdown();
    await rm(home, { recursive: true, force: true });
});

test('a host task reads the child thread and keeps pending requests outside its page', async () => {
    core.get('child')!.upsertItems([
        {
            id: 'approval',
            kind: 'approval',
            createdAt: 1,
            turnId: null,
            requestId: 'request',
            toolUseId: 'write',
            toolName: 'Write',
            input: {},
            description: 'Write a file',
            canAllowAlways: false,
            decision: 'pending'
        },
        { id: 'last', kind: 'note', createdAt: 2, turnId: null, level: 'info', text: 'The latest work' }
    ]);

    const page = await core.subagent('reader', { chatId: 'parent', toolUseId: 'task-one', limit: 1 });

    expect(page.items.map((item) => item.id)).toEqual(['last']);
    expect(page.pending?.map((item) => item.id)).toEqual(['approval']);
    expect(page.context?.chatId).toBe('child');
    expect((await core.subagentItems('parent', 'task-one')).map((item) => item.id)).toEqual(['approval', 'last']);
});

test('a watch follows the child and releases on unwatch and disconnect', async () => {
    const changed: string[] = [];
    core.subscribe('reader', (event) => {
        if (event.event === 'chat.subagentChanged') {
            changed.push(`${event.payload.chatId}/${event.payload.toolUseId}`);
        }
    });
    await core.subagent('reader', { chatId: 'parent', toolUseId: 'task-one', watch: true });
    core.get('child')!.addNote('info', 'First change');
    expect(changed).toContain('parent/task-one');

    await core.subagent('reader', { chatId: 'parent', toolUseId: 'task-one', watch: false });
    changed.length = 0;
    core.get('child')!.addNote('info', 'No longer watched');
    expect(changed).toEqual([]);

    await core.subagent('reader', { chatId: 'parent', toolUseId: 'task-one', watch: true });
    core.detachAll('reader');
    core.get('child')!.addNote('info', 'Disconnected');
    expect(changed).toEqual([]);
});

test('the host stops a running child and settled work is left alone', async () => {
    const stopped: string[][] = [];
    const stopNode = async (id: string, reason: string) => {
        stopped.push([id, reason]);
    };

    await core.stopSubagent('parent', 'task-one', stopNode);
    expect(stopped).toEqual([['child', 'a person stopped it']]);

    core.get('parent')!.upsertItems([{ ...taskRow(), status: 'done' }]);
    await core.stopSubagent('parent', 'task-one', stopNode);
    expect(stopped).toHaveLength(1);
});

test('a task whose child has no chat remains a host operation', async () => {
    core.get('parent')!.upsertItems([taskRow('terminal')]);

    await expect(core.subagent('reader', { chatId: 'parent', toolUseId: 'task-one' })).rejects.toMatchObject({ code: 'chat-unsupported' });
});

test('a stored child is loaded when only the parent is open after a restart', async () => {
    core.get('child')!.addNote('info', 'Stored work');
    await core.shutdown();
    core = new ChatCore({ providers, store: new ChatStore(home), attachments: new AttachmentStore(home) });
    await core.create({ chatId: 'parent' });
    expect(core.get('child')).toBeUndefined();

    const page = await core.subagent('reader', { chatId: 'parent', toolUseId: 'task-one' });
    expect(page.items).toMatchObject([{ kind: 'note', text: 'Stored work' }]);
});
