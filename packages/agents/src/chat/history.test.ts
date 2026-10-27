import { describe, expect, test } from 'bun:test';
import { CHAT_OUTLINE_TEXT_CHARS, ChatItemSchema, type ChatInfo, type ChatItem } from '@adecore/agent-contracts';
import { ChatThread } from './thread.ts';

const info = { chatId: 'history' } as ChatInfo;

function message(i: number, text = `Message ${i}`): ChatItem {
    return { id: `m${i}`, kind: 'assistant', text, streaming: false } as ChatItem;
}

describe('chat history', () => {
    test('pages a large synthetic thread without dropping or repeating items', () => {
        const items = Array.from({ length: 2871 }, (_, i) => message(i, 'output '.repeat(900)));
        const thread = new ChatThread(info, items);
        let page = thread.history(60);
        const firstBytes = Buffer.byteLength(JSON.stringify(page));
        expect(firstBytes).toBeLessThan(512 * 1024);
        expect(page.items.length).toBe(60);
        let all = page.items;
        let requests = 1;

        while (page.history.cursor) {
            page = thread.history(60, page.history.cursor);
            all = [...page.items, ...all];
            requests++;
        }

        expect(all).toEqual(items);
        expect(requests).toBe(48);
        console.info(`Synthetic history: ${Buffer.byteLength(JSON.stringify(items))} bytes full, ${firstBytes} bytes first page, ${requests} pages`);
    });

    test('byte budget splits pages and never truncates an atomic item', () => {
        const large = message(1, 'x'.repeat(600_000));
        const thread = new ChatThread(info, [message(0), large, message(2)]);
        const page = thread.history();
        expect(page.items).toEqual([message(2)]);
        const older = thread.history(60, page.history.cursor!);
        expect(older.items).toEqual([large]);
        expect(thread.history(60, older.history.cursor!).items).toEqual([message(0)]);
    });

    test('appends preserve cursors, changes are read fresh, and reset invalidates cursors', () => {
        const thread = new ChatThread(info, [message(0), message(1), message(2)]);
        const page = thread.history(1);
        thread.upsert(message(3));
        thread.upsert(message(1, 'changed'));
        expect(thread.history(2, page.history.cursor!).items).toEqual([message(0), message(1, 'changed')]);
        thread.reset({});
        thread.upsert(message(0));
        expect(() => thread.history(2, page.history.cursor!)).toThrow('conversation changed');
    });

    test('pending requests are available outside the page and item indices remain stable', () => {
        const approval: ChatItem = {
            id: 'a',
            kind: 'approval',
            createdAt: 0,
            turnId: null,
            requestId: 'r',
            toolUseId: null,
            toolName: 'Bash',
            input: { command: 'ls' },
            description: null,
            canAllowAlways: false,
            decision: 'pending'
        };

        const thread = new ChatThread(info, [approval, message(0), message(1)]);
        expect(thread.history(1).items).toEqual([message(1)]);
        expect(thread.pending() as ChatItem[]).toEqual([approval]);
        expect(thread.upsert({ ...approval, decision: 'allow' } as ChatItem)).toMatchObject({ historyIndex: 0 });
        expect(thread.pending()).toEqual([]);
        expect(thread.upsert(message(2))).toMatchObject({ historyIndex: 3 });
    });

    test('sub-agents from before the page that still run or settled since the last message are available outside it', () => {
        const user = (i: number, createdAt: number): ChatItem => ({ id: `u${i}`, kind: 'user', text: 'Go', createdAt, turnId: null }) as ChatItem;

        const subagent = (id: string, status: 'running' | 'done', finishedAt: number | null): ChatItem =>
            ({ id, kind: 'subagent', createdAt: 0, turnId: null, toolUseId: id, status, finishedAt }) as ChatItem;

        const thread = new ChatThread(info, [
            subagent('old', 'done', 5),
            subagent('woken', 'running', null),
            user(0, 10),
            subagent('after', 'done', 20),
            message(0)
        ]);

        const page = thread.history(1);
        expect(page.history.start).toBe(4);
        expect(thread.subagentsBefore(page.history.start).map((item) => item.id)).toEqual(['woken', 'after']);
        expect(thread.subagentsBefore(1)).toEqual([]);
    });

    test('the outline before the page holds the messages, the wakes and the marked replies, cut down', () => {
        const long = 'x'.repeat(400);
        const user = { id: 'u0', kind: 'user', text: long, createdAt: 1, turnId: 't0', mentions: ['a.ts'] } as ChatItem;
        const checkpointDiff = { files: [], truncated: false };
        const wake: ChatItem = { id: 't1', kind: 'turn', createdAt: 2, turnId: 't1', state: 'done', endedAt: 3, costUsd: 0, taskIds: ['k1'], checkpointDiff };
        const reply = (id: string): ChatItem => ({ id, kind: 'assistant', text: long, createdAt: 3, turnId: 't1', streaming: false });
        const thread = new ChatThread(info, [user, wake, reply('a0'), reply('a1'), message(0)]);
        const start = thread.history(1).history.start;
        const outline = thread.outlineBefore(start, new Set(['a1']));
        expect(outline.map((item) => item.id)).toEqual(['u0', 't1', 'a1']);
        expect(outline[0]).toEqual({ id: 'u0', kind: 'user', text: 'x'.repeat(CHAT_OUTLINE_TEXT_CHARS), createdAt: 1, turnId: 't0' });
        expect(outline[1]).not.toHaveProperty('checkpointDiff');
        expect(outline[2]).toMatchObject({ text: 'x'.repeat(CHAT_OUTLINE_TEXT_CHARS), streaming: false });
        expect(outline.every((item) => ChatItemSchema.safeParse(item).success)).toBe(true);
        expect(thread.outlineBefore(0)).toEqual([]);
    });
});
