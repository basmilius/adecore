import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChatNoteMessage, ChatTurnItem } from '@adecore/agent-contracts';
import type { ChatSession } from '../chat/chat-session.ts';
import { chatNoticeTargets, deliverToChat, showNotices, steerNotices, type ChatNoticeTargets, type NoticeChat } from './deliver-notice.ts';
import { MAX_MESSAGE_TURNS, MESSAGE_TURN_WINDOW_MS } from './message-turns.ts';
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
        mayWake: () => true,
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

    test('a chat that messages woke as often as they may this hour only gets it to wait, marked as held for that', async () => {
        expect((await deliverToChat(store, targets({ chat: async () => 'idle', mayWake: () => false }), left('one too many'))).outcome).toBe('rate-limit');
        expect(store.waiting('chat-2').map((notice) => notice.limited)).toEqual([true]);
    });

    test('a running chat past the limit still keeps it, since a message that joins a turn opens none', async () => {
        const past = targets({ chat: async () => 'running', mayWake: () => false });
        expect((await deliverToChat(store, past, left('and the tests'))).outcome).toBe('in-turn');
        expect(store.waiting('chat-2')[0]!.limited).toBeUndefined();
    });
});

describe('steerNotices', () => {
    const steerWords = { heard: (notice: Notice): string => notice.text, prompt: (count: number): string => `${count} messages` };

    test('what the running turn takes leaves the queue', async () => {
        await store.put(left('one'));
        const steers: { preamble: string }[] = [];

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

        expect(steers).toMatchObject([{ preamble: 'one' }]);
        expect(store.waiting('chat-2')).toEqual([]);
    });

    test('what it refuses stays for the turn after it', async () => {
        await store.put(left('one'));
        await steerNotices(store, { steer: async () => false }, steerWords, 'chat-2');
        expect(store.waiting('chat-2')).toHaveLength(1);
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

    test('lets messages wake a chat until they opened the most turns the window allows there', () => {
        const now = 10 * MESSAGE_TURN_WINDOW_MS;
        const woken = (count: number, at: number): ChatTurnItem[] =>
            Array.from({ length: count }, (_, i) => ({ ...turn(`t${at}-${i}`, ['chat-1']), createdAt: at, state: 'done' as const }));

        const held = new Map([
            ['chat-busy', session(null, woken(MAX_MESSAGE_TURNS, now - 1000))],
            ['chat-room', session(null, woken(MAX_MESSAGE_TURNS - 1, now - 1000))],
            ['chat-older', session(null, woken(MAX_MESSAGE_TURNS, now - MESSAGE_TURN_WINDOW_MS - 1))],
            [
                'chat-asked',
                session(
                    null,
                    Array.from({ length: MAX_MESSAGE_TURNS }, (_, i) => ({ ...turn(`p${i}`), createdAt: now, origin: 'user' as const }))
                )
            ]
        ]);

        const targets = chatNoticeTargets({ get: (id) => held.get(id), hasStored: async () => false }, () => now);
        expect(targets.mayWake('chat-busy')).toBe(false);
        expect(targets.mayWake('chat-room')).toBe(true);
        expect(targets.mayWake('chat-older')).toBe(true);
        expect(targets.mayWake('chat-asked')).toBe(true);
        expect(targets.mayWake('chat-none')).toBe(true);
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
