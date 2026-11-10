import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HOST_TASK_ORIGIN, type ChatInfo, type ChatItem, type ChatSubagentItem, type Task } from '@adecore/agent-contracts';
import { UI_FENCE_LANGUAGE } from '@adecore/intelligent-ui';
import { ProviderRegistry } from '../providers/registry.ts';
import { claudeProvider } from '../testing/providers.ts';
import { AttachmentStore } from './attachment-store.ts';
import { BookmarkStore, bookmarkFileName } from './bookmark-store.ts';
import { ChatCore, type ChatCoreHooks } from './chat-core.ts';
import type { ChatSidecar } from './chat-sidecar.ts';
import { ChatStore } from './chat-store.ts';
import { visualFileName, VisualStore } from './visual-store.ts';

const providers = new ProviderRegistry({
    detect: async () => ({ installed: true, version: 'test' }),
    providers: [claudeProvider]
});

let home: string;
let store: ChatStore;
let core: ChatCore | null;

function open(
    options: { sidecars?: readonly ChatSidecar[]; hooks?: ChatCoreHooks; taskRemovedReason?: string; uiFenceLanguage?: string; withStores?: boolean } = {}
): ChatCore {
    const attachments = new AttachmentStore(home);
    const { withStores = false, ...rest } = options;

    core = new ChatCore({
        providers,
        store,
        attachments,
        env: { HOME: home, PATH: '/bin' },
        ...(withStores ? { bookmarks: new BookmarkStore(home), visuals: new VisualStore(home, attachments) } : {}),
        ...rest
    });

    return core;
}

function storedInfo(chatId: string): ChatInfo {
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
        createdAt: 1
    };
}

function taskOf(id: string, patch: Partial<Task> = {}): Task {
    return {
        id,
        projectId: 'project',
        parentId: 'parent',
        childId: `child-${id}`,
        title: `Task ${id}`,
        prompt: 'do it',
        status: 'open',
        result: null,
        createdAt: 5,
        settledAt: null,
        wake: 'pending',
        ...patch
    };
}

function rowsOf(chats: ChatCore, chatId: string): ChatSubagentItem[] {
    return chats
        .get(chatId)!
        .thread.list()
        .filter((item): item is ChatSubagentItem => item.kind === 'subagent');
}

beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'adecore-core-sidecars-'));
    store = new ChatStore(home);
    core = null;
});

afterEach(async () => {
    await core?.shutdown();
    await rm(home, { recursive: true, force: true });
});

describe('the sidecars of ChatCore', () => {
    function recorder(calls: string[]): ChatSidecar {
        return {
            owns: (name) => name.endsWith('.notes.json'),
            removeChat: async (chatId) => {
                calls.push(`remove ${chatId}`);
            },
            copyChat: async (from, to, kept) => {
                calls.push(`copy ${from} to ${to} keeping ${kept.item('a')}`);
            }
        };
    }

    test('keep their files out of the chat list, bookmarks and visuals among them', async () => {
        open({ sidecars: [recorder([])], withStores: true });
        await store.write('chat-1', storedInfo('chat-1'), []);
        await writeFile(join(home, 'chats', 'chat-1.notes.json'), '{}');
        await writeFile(join(home, 'chats', bookmarkFileName('chat-1')), '{}');
        await writeFile(join(home, 'chats', visualFileName('chat-1')), '{}');

        expect(await store.list()).toEqual(['chat-1']);
    });

    test('are removed with a clear, a removal and the record of a chat nobody loaded', async () => {
        const calls: string[] = [];
        const chats = open({ sidecars: [recorder(calls)] });
        await store.write('stored', storedInfo('stored'), []);
        await store.write('cleared', storedInfo('cleared'), []);
        await store.write('removed', storedInfo('removed'), []);

        expect(await chats.deleteRecord('stored')).toBe(true);
        await chats.create({ chatId: 'cleared' });
        await chats.clear('cleared');
        await chats.create({ chatId: 'removed' });
        await chats.kill('removed');

        expect(calls).toEqual(['remove stored', 'remove cleared', 'remove removed']);
    });

    test('copy into a fork what it keeps, in the order they were given', async () => {
        const calls: string[] = [];
        const chats = open({ sidecars: [recorder(calls), { copyChat: async () => void calls.push('second') }] });

        await chats.copySidecars('original', 'fork', { item: (itemId) => itemId === 'a', visual: () => false });

        expect(calls).toEqual(['copy original to fork keeping true', 'second']);
    });
});

describe('the task rows of ChatCore', () => {
    const hooksFor = (tasks: () => Task[]): ChatCoreHooks => ({ taskRows: () => tasks() });

    test('are laid when a chat opens, written again from the task, and the same row twice changes nothing', async () => {
        const tasks = [taskOf('t1'), taskOf('t2', { status: 'done', result: { text: 'Fixed', source: 'done', at: 8 }, settledAt: 8 })];
        const chats = open({ hooks: hooksFor(() => tasks) });
        await chats.create({ chatId: 'parent', cwd: home });

        expect(rowsOf(chats, 'parent').map((row) => [row.id, row.toolUseId, row.origin, row.status, row.childId, row.result])).toEqual([
            ['task-t1', 'task-t1', HOST_TASK_ORIGIN, 'running', 'child-t1', null],
            ['task-t2', 'task-t2', HOST_TASK_ORIGIN, 'done', 'child-t2', 'Fixed']
        ]);

        chats.syncTaskRow(taskOf('t1', { status: 'failed', settledAt: 9 }));
        expect(rowsOf(chats, 'parent')[0]).toMatchObject({ status: 'failed', finishedAt: 9 });
        const before = JSON.stringify(rowsOf(chats, 'parent'));
        chats.syncTaskRow(taskOf('t1', { status: 'failed', settledAt: 9 }));
        expect(JSON.stringify(rowsOf(chats, 'parent'))).toBe(before);
    });

    test('say once why a cancelled task failed, in the words of the host when the task has none', async () => {
        const chats = open({ hooks: hooksFor(() => []), taskRemovedReason: 'its node was removed' });
        await chats.create({ chatId: 'parent', cwd: home });

        const cancelled = taskOf('t1', { status: 'cancelled', settledAt: 9 });
        chats.syncTaskRow(cancelled);
        chats.syncTaskRow(cancelled);

        const notes = chats
            .get('parent')!
            .thread.list()
            .filter((item: ChatItem) => item.kind === 'note');
        expect(notes.map((note) => note.id)).toEqual(['task-t1-cancelled']);
        expect(notes[0]).toMatchObject({ level: 'warning', text: 'The task "Task t1" was cancelled: its node was removed' });
    });

    test('stay hidden after a clear, also in a core that loads the chat from disk', async () => {
        const tasks = [taskOf('t1')];
        const chats = open({ hooks: hooksFor(() => tasks) });
        await chats.create({ chatId: 'parent', cwd: home });
        expect(rowsOf(chats, 'parent')).toHaveLength(1);

        await chats.clear('parent');
        tasks.push(taskOf('t2'));
        chats.syncTaskRow(taskOf('t1', { status: 'done' }));
        expect(rowsOf(chats, 'parent')).toEqual([]);
        await chats.save('parent');
        expect((await store.read('parent'))?.extras).toEqual({ clearedTaskIds: ['t1'] });

        await chats.shutdown();
        const again = open({ hooks: hooksFor(() => tasks) });
        await again.create({ chatId: 'parent' });
        expect(rowsOf(again, 'parent').map((row) => row.id)).toEqual(['task-t2']);
    });

    test('lie below the notes the host opens a chat with and above what it lays down once opened', async () => {
        const chats = open({
            hooks: {
                ...hooksFor(() => [taskOf('t1')]),
                openingNotes: (session) => void session.addNote('info', 'above'),
                opened: async (session) => void session.addNote('info', 'below')
            }
        });
        await chats.create({ chatId: 'parent', cwd: home });

        const thread = chats
            .get('parent')!
            .thread.list()
            .map((item: ChatItem) => (item.kind === 'note' ? item.text : item.id));
        expect(thread).toEqual(['above', 'task-t1', 'below']);
    });

    test('keep the extras of the host beside the hidden ones', async () => {
        const chats = open({ hooks: { ...hooksFor(() => [taskOf('t1')]), recordExtras: () => ({ pinned: true }) } });
        await chats.create({ chatId: 'parent', cwd: home });
        await chats.clear('parent');
        await chats.save('parent');

        expect((await store.read('parent'))?.extras).toEqual({ pinned: true, clearedTaskIds: ['t1'] });
    });
});

describe('the UI fence of ChatCore', () => {
    test('is the one of the host, or the default of the UI compiler', () => {
        expect(open().uiFence).toBe(UI_FENCE_LANGUAGE);
        expect(open({ uiFenceLanguage: 'host-ui' }).uiFence).toBe('host-ui');
    });
});
