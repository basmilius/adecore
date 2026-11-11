import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { ChatAttachResultSchema, ChatEventEnvelopeSchema, ChatItemSchema, ChatListResultSchema, ChatSubagentResultSchema, type ChatInfo } from './chat.ts';
import * as contracts from './index.ts';
import { openValues, readTolerant, wireStampsIn, type OpenUnions, type OpenWords } from './tolerance.ts';

const info: ChatInfo = {
    chatId: 'chat-1',
    provider: 'claude',
    cwd: '/work',
    agentSessionId: null,
    model: null,
    selection: { model: 'claude-sonnet-5', options: {} },
    runtimeMode: 'supervised',
    status: 'idle',
    running: true,
    activeTurnId: null,
    slashCommands: [],
    usage: { contextTokens: 0, contextWindow: 200000, costUsd: 0, turns: 0 },
    createdAt: 0
};

const user = { id: 'user-1', kind: 'user', createdAt: 1, turnId: null, text: 'Hello' };
const approval = {
    id: 'approval-1',
    kind: 'approval',
    createdAt: 2,
    turnId: 'turn-1',
    requestId: 'request-1',
    toolUseId: null,
    toolName: 'Bash',
    input: { command: 'ls' },
    description: null,
    canAllowAlways: false,
    decision: 'pending'
};

function readable<S extends z.core.$ZodType>(schema: S, input: unknown) {
    const read = readTolerant(schema, input);

    if (!read.success) {
        throw new Error(`Refused: ${read.error.message}`);
    }

    return read;
}

describe('reading what a newer host sent', () => {
    test('reads a reply this version fully knows exactly as the strict parse does', () => {
        const input = { info, items: [user, approval], seq: 3 };

        expect(readTolerant(ChatAttachResultSchema, input)).toEqual({ success: true, data: ChatAttachResultSchema.parse(input), degraded: [] });
    });

    test('keeps an item of an unknown kind in its place with the fields every item has and the item as it came', () => {
        const future = { id: 'future-1', kind: 'future-kind', createdAt: 3, turnId: 'turn-1', shape: { nested: [1] } };
        const { data, degraded } = readable(ChatAttachResultSchema, { info, items: [user, future, approval] });

        expect<unknown>(data.items).toEqual([user, { kind: 'unknown', id: 'future-1', createdAt: 3, turnId: 'turn-1', raw: future }, approval]);
        expect(degraded).toEqual([{ kind: 'unknown-member', path: ['items', 1], name: 'ChatItem', tag: 'future-kind' }]);
    });

    test('turns a pending approval with a decision it does not know into an unknown item, never a waiting approval', () => {
        const escalated = { ...approval, decision: 'escalated' };
        const { data } = readable(ChatAttachResultSchema, { info, items: [], pending: [escalated] });

        expect<unknown>(data.pending).toEqual([{ kind: 'unknown', id: 'approval-1', createdAt: 2, turnId: 'turn-1', raw: escalated }]);
    });

    test('degrades a pending request of a subagent the same way', () => {
        const { data } = readable(ChatSubagentResultSchema, {
            items: [],
            history: { cursor: null },
            source: 'claude-transcript',
            live: false,
            pending: [{ ...approval, allowAlways: { label: 'Always' } }]
        });

        expect(data.pending?.map((item) => item.kind)).toEqual(['unknown']);
    });

    test('leaves out an item without the fields every item has, since it has no place to keep', () => {
        const { data, degraded } = readable(ChatAttachResultSchema, { info, items: [user, { kind: 'future-kind', createdAt: 3, turnId: null }] });

        expect<unknown>(data.items).toEqual([user]);
        expect(degraded).toEqual([{ kind: 'dropped-element', path: ['items', 1] }]);
    });

    test('keeps a word it does not know where the vocabulary is open, inside an item that still reads', () => {
        const { data, degraded } = readable(ChatAttachResultSchema, {
            info: { ...info, status: 'future-status', goal: { objective: 'Ship', status: 'future-goal' } },
            items: []
        });

        expect<unknown>(data.info.status).toBe('future-status');
        expect<unknown>(data.info.goal?.status).toBe('future-goal');
        expect(degraded.map((entry) => entry.kind)).toEqual(['unknown-word', 'unknown-word']);
    });

    test('keeps an event of an unknown type, and an unknown item inside a known event', () => {
        const future = { type: 'future-event', itemId: 'user-1' };
        const event = readable(ChatEventEnvelopeSchema, { chatId: 'chat-1', seq: 4, event: future });
        const item = readable(ChatEventEnvelopeSchema, { chatId: 'chat-1', event: { type: 'item', item: { ...user, kind: 'future-kind' } } });

        expect<unknown>(event.data.event).toEqual({ type: 'unknown', raw: future });
        expect(item.data.event.type === 'item' && item.data.event.item.kind).toBe('unknown');
    });

    test('leaves a chat it cannot read out of the list and keeps the others', () => {
        const { cwd: _cwd, ...withoutCwd } = info;
        const { data } = readable(ChatListResultSchema, { chats: [info, { ...withoutCwd, chatId: 'chat-2' }] });

        expect(data.chats.map((chat) => chat.chatId)).toEqual(['chat-1']);
    });

    test('holds a string that names its known words to its own rules, since any word it takes is already readable', () => {
        const schema = z.object({ kind: openValues(z.string().regex(/^[a-z]+$/), 'TestKind', { known: ['known'] }), items: z.array(ChatItemSchema) });
        const future = { ...user, kind: 'future-kind' };

        expect(readable(schema, { kind: 'newer', items: [future] }).degraded.map((entry) => entry.kind)).toEqual(['unknown-member']);
        expect(readTolerant(schema, { kind: 'Not A Kind', items: [future] }).success).toBe(false);
    });

    test('refuses a reply that fails where nothing around it is open, as the strict parse does', () => {
        expect(readTolerant(ChatAttachResultSchema, { info: { ...info, running: 'yes' }, items: [{ ...user, kind: 'future-kind' }] }).success).toBe(false);
    });

    test('leaves the strict parse a host does on what it receives as it was', () => {
        expect(ChatItemSchema.safeParse({ ...user, kind: 'future-kind' }).success).toBe(false);
        expect(ChatItemSchema.safeParse({ ...approval, decision: 'escalated' }).success).toBe(false);
    });
});

describe('the tables that type a tolerant read', () => {
    test('name exactly the open unions and vocabularies these contracts stamp', () => {
        const unions = { ChatItem: true, ChatEvent: true, ChatPendingRequest: true } satisfies Record<keyof OpenUnions, true>;
        const words = {
            AgentStatus: true,
            ChatBackgroundTaskKind: true,
            ChatGoalStatus: true,
            ChatRequestKind: true,
            ChatTurnLimitKind: true,
            RuntimeMode: true,
            TaskPauseKind: true,
            TaskResultSource: true,
            TaskStatus: true,
            TaskWake: true,
            UsageProvider: true
        } satisfies Record<keyof OpenWords, true>;
        const schemas: z.core.$ZodType[] = Object.values(contracts as Record<string, unknown>).filter((value) => value instanceof z.ZodType);
        const stamped = schemas.flatMap((schema) => wireStampsIn(schema).map(({ stamp }) => stamp));
        const names = (open: string) => [...new Set(stamped.flatMap((stamp) => (stamp.open === open && 'name' in stamp ? [stamp.name] : [])))].sort();

        expect(names('union')).toEqual(Object.keys(unions).sort());
        expect(names('values')).toEqual(Object.keys(words).sort());
    });
});
