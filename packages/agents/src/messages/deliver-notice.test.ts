import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChatNoteMessage, ChatTurnItem } from '@adecore/agent-contracts';
import type { ChatSession } from '../chat/chat-session.ts';
import {
    chatNoticeTargets,
    deliverToChat,
    MAX_MESSAGE_HOPS,
    showNotices,
    steerNotices,
    turnHop,
    type ChatNoticeTargets,
    type NoticeChat
} from './deliver-notice.ts';
import { MAX_NOTICES, NoticeStore, type Notice } from './notice-store.ts';

let dataDir: string;
let store: NoticeStore;

function left(text: string, targetId = 'chat-2'): Omit<Notice, 'createdAt'> {
    return {
        projectId: 'project-1',
        targetId,
        from: 'chat-1',
        fromTitle: 'Lead',
        text
    };
}

const words = { shown: (notice: Notice): string => `${notice.fromTitle} wrote: ${notice.text}` };

function turn(id: string, messageFrom?: string[]): ChatTurnItem {
    return {
        id,
        kind: 'turn',
        createdAt: 1,
        turnId: id,
        state: 'running',
        origin: 'agent',
        endedAt: null,
        costUsd: 0,
        ...(messageFrom ? { messageFrom } : {})
    };
}

beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'agents-deliver-'));
    store = new NoticeStore(dataDir);
});

afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
});

describe('deliverToChat', () => {
    const targets = (overrides: Partial<ChatNoticeTargets> = {}): ChatNoticeTargets => ({
        chat: async () => 'none',
        hop: () => 0,
        ...overrides
    });

    test('a chat between turns is owed one, and the message waits for it in the queue', async () => {
        expect(await deliverToChat(store, targets({ chat: async () => 'idle' }), left('the build is green'))).toEqual({ outcome: 'wake', waiting: 1 });
        // The turn's preamble is what takes it.
        expect(store.waiting('chat-2')).toHaveLength(1);
    });

    test('a chat in a turn keeps it, and a node that runs nothing waits to start', async () => {
        expect(await deliverToChat(store, targets({ chat: async () => 'running' }), left('the build is green'))).toEqual({ outcome: 'in-turn', waiting: 1 });
        expect(await deliverToChat(store, targets(), left('and another', 'chat-3'))).toEqual({ outcome: 'no-chat', waiting: 1 });
    });

    test('a chain of messages wakes up to the hop limit, then only waits', async () => {
        const atHop = (hop: number): ChatNoticeTargets => targets({ chat: async () => 'idle', hop: () => hop });
        expect((await deliverToChat(store, atHop(MAX_MESSAGE_HOPS - 1), left('the last step'))).outcome).toBe('wake');
        expect((await deliverToChat(store, atHop(MAX_MESSAGE_HOPS), left('one too many'))).outcome).toBe('hop-limit');
        expect(store.waiting('chat-2').map((notice) => notice.hop)).toEqual([MAX_MESSAGE_HOPS, MAX_MESSAGE_HOPS + 1]);
    });

    test('a running chat past the limit is owed nothing either', async () => {
        const past = targets({ chat: async () => 'running', hop: () => MAX_MESSAGE_HOPS });
        expect((await deliverToChat(store, past, left('one too many'))).outcome).toBe('hop-limit');
    });
});

describe('steerNotices', () => {
    const steerWords = { heard: (notice: Notice): string => notice.text, prompt: (count: number): string => `${count} messages` };

    test('what the running turn takes leaves the queue, at the furthest hop among it', async () => {
        await store.put({ ...left('one'), hop: 1 });
        const steers: { preamble: string; messageHop: number }[] = [];

        await steerNotices(
            store,
            {
                steer: async (_id, steer) => {
                    steers.push(steer);
                    return true;
                }
            },
            steerWords,
            'chat-2'
        );

        expect(steers).toMatchObject([{ preamble: 'one', messageHop: 1 }]);
        expect(store.waiting('chat-2')).toEqual([]);
    });

    test('what it refuses stays for the turn after it, and what is past the limit is never offered', async () => {
        await store.put({ ...left('one'), hop: 1 });
        await steerNotices(store, { steer: async () => false }, steerWords, 'chat-2');
        expect(store.waiting('chat-2')).toHaveLength(1);

        await store.remove('chat-2', store.waiting('chat-2'));
        await store.put({ ...left('late'), hop: MAX_MESSAGE_HOPS + 1 });
        let asked = false;
        await steerNotices(
            store,
            {
                steer: async () => {
                    asked = true;
                    return true;
                }
            },
            steerWords,
            'chat-2'
        );
        expect(asked).toBe(false);
    });
});

describe('NoticeStore settling', () => {
    test('tells what was heard and what the cap dropped', async () => {
        const told: [string, string][] = [];
        store.onSettled((_id, notices, state) => told.push(...notices.map((notice): [string, string] => [notice.text, state])));

        for (let i = 0; i <= MAX_NOTICES; i++) {
            await store.put(left(`message ${i}`));
        }

        expect(told).toEqual([['message 0', 'dropped']]);
        store.take('chat-2');
        expect(told).toHaveLength(MAX_NOTICES + 1);
        expect(told.at(-1)).toEqual([`message ${MAX_NOTICES}`, 'heard']);
    });
});

describe('turnHop', () => {
    test('a turn carries its hop, and one from before hops stands where its answer could still go', () => {
        expect(turnHop([{ ...turn('t1', ['chat-1']), messageHop: 3 }], 't1')).toBe(3);
        expect(turnHop([turn('t1', ['chat-1'])], 't1')).toBe(2);
        expect(turnHop([turn('t1')], 't1')).toBe(0);
    });

    test('work a turn a message opened left running goes on in that step, between turns and in the turn the CLI opens about it', () => {
        const ended = { ...turn('t1', ['chat-1']), state: 'done' as const, messageHop: 1 };
        expect(turnHop([ended], null)).toBe(1);
        expect(turnHop([ended, turn('t2')], 't2')).toBe(1);
    });

    test('a turn a person or a settled task opened counts from zero', () => {
        const ended = { ...turn('t1', ['chat-1']), state: 'done' as const, messageHop: 3 };
        expect(turnHop([ended, { ...turn('t2'), origin: 'user' }], 't2')).toBe(0);
        expect(turnHop([ended, { ...turn('t2'), taskIds: ['task-1'] }], 't2')).toBe(0);
        expect(turnHop([ended, { ...turn('t2'), origin: 'user', state: 'done' }, turn('t3')], 't3')).toBe(0);
    });
});

describe('chatNoticeTargets', () => {
    const session = (activeTurnId: string | null, items: ChatTurnItem[] = []): ChatSession =>
        ({ info: { activeTurnId }, thread: { list: () => items } }) as unknown as ChatSession;

    test('reads a chat as idle, running or absent, and one nobody loaded as idle', async () => {
        const held = new Map([
            ['chat-idle', session(null)],
            ['chat-busy', session('t1', [turn('t1')])]
        ]);

        const targets = chatNoticeTargets({ get: (id) => held.get(id), hasStored: async (id) => id === 'chat-cold' });
        expect(await targets.chat('chat-idle')).toBe('idle');
        expect(await targets.chat('chat-busy')).toBe('running');
        expect(await targets.chat('chat-cold')).toBe('idle');
        expect(await targets.chat('chat-none')).toBe('none');
    });

    test('knows a sender whose turn a message opened', () => {
        const held = new Map([
            ['chat-woken', session('t1', [turn('t1', ['chat-1'])])],
            ['chat-asked', session('t2', [turn('t2')])]
        ]);

        const targets = chatNoticeTargets({ get: (id) => held.get(id), hasStored: async () => false });
        expect(targets.hop('chat-woken')).toBe(2);
        expect(targets.hop('chat-asked')).toBe(0);
        expect(targets.hop('chat-none')).toBe(0);
    });
});

describe('showNotices', () => {
    const chat = (has: boolean, lines: string[], messages: ChatNoteMessage[] = []): NoticeChat => ({
        has: () => Promise.resolve(has),
        note: (_id, text, message) => {
            lines.push(text);
            messages.push(message);

            return Promise.resolve();
        }
    });

    test('puts everything waiting for a chat in its thread, once', async () => {
        const lines: string[] = [];
        await store.put(left('the build is green'));
        await store.put(left('and the tests'));
        await showNotices(store, chat(true, lines), words, 'chat-2');
        await showNotices(store, chat(true, lines), words, 'chat-2');
        expect(lines).toEqual(['Lead wrote: the build is green', 'Lead wrote: and the tests']);
    });

    test('hands each line the message it is about, so a client can draw it as said to the chat', async () => {
        const messages: ChatNoteMessage[] = [];
        await store.put(left('the build is green'));
        await showNotices(store, chat(true, [], messages), words, 'chat-2');
        expect(messages).toEqual([{ from: 'chat-1', title: 'Lead', text: 'the build is green', state: 'waiting' }]);
    });

    test('an id no chat holds keeps its messages unshown, for the chat that opens on it later', async () => {
        const lines: string[] = [];
        await store.put(left('read the plan', 'chat-3'));
        await showNotices(store, chat(false, lines), words, 'chat-3');
        expect(lines).toEqual([]);
        await showNotices(store, chat(true, lines), words, 'chat-3');
        expect(lines).toEqual(['Lead wrote: read the plan']);
    });
});
