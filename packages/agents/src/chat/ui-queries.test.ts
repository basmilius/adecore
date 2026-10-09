import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import type { ChatAssistantItem, ChatEvent, ChatInfo } from '@adecore/agent-contracts';
import { compileUiBlock, resolveUiChoice } from '@adecore/intelligent-ui';
import { claudeProvider } from '../providers/claude-provider.ts';
import { ChatSession } from './chat-session.ts';
import { ChatUiQueries, type ChatUiHost } from './ui-queries.ts';

function rig() {
    let permitted = true;
    let reads = 0;
    let captures = 0;
    let value: unknown = { count: 7 };
    const host: ChatUiHost = {
        capture: async () => {
            captures++;
            return { readable: permitted };
        },
        sources: {
            status: {
                args: z.object({ repo: z.string(), limit: z.number().default(3) }).strict(),
                result: z.object({ count: z.number() }).strict(),
                authorize: async (_info, access) => {
                    if (!permitted || !(access as { readable?: boolean } | null)?.readable) {
                        throw new Error('No access');
                    }
                },
                read: async () => {
                    reads++;
                    return value;
                }
            }
        }
    };
    const block = {
        ...compileUiBlock(
            '$data = @Query("status", {repo: "."})\n<Stats><Stat label="Count" value={$data.count}/></Stats>\n<Choices><Choice context={"Count " + $data.count}>Choose</Choice></Choices>',
            { id: 'block', final: true, querySchemas: { status: host.sources.status.args } }
        ),
        revision: 'rev'
    };
    const item: ChatAssistantItem = {
        id: 'reply',
        kind: 'assistant',
        text: '@Query',
        createdAt: 1,
        turnId: 'turn',
        streaming: false,
        ui: [block],
        uiQueries: { authorChatId: 'chat', access: { readable: true }, blocks: {} }
    };
    const info: ChatInfo = {
        chatId: 'chat',
        provider: 'claude',
        cwd: '/tmp',
        agentSessionId: null,
        model: null,
        selection: claudeProvider.catalog.normalize(undefined),
        runtimeMode: 'supervised',
        status: 'idle',
        running: false,
        activeTurnId: null,
        slashCommands: [],
        usage: { contextTokens: 0, contextWindow: 200000, costUsd: 0, turns: 0 },
        createdAt: 1
    };
    const events: ChatEvent[] = [];
    const session = new ChatSession({
        info,
        items: [item],
        provider: claudeProvider,
        command: ['unused'],
        env: () => ({}),
        emit: (event) => events.push(event),
        persist: () => {},
        persistSoon: () => {}
    });
    const queries = new ChatUiQueries(host);
    const payload = { chatId: 'chat', itemId: 'reply', blockId: 'block', revision: 'rev', query: '$data' };
    return {
        queries,
        session,
        payload,
        block,
        item,
        events,
        counts: () => ({ reads, captures }),
        revoke: () => {
            permitted = false;
        },
        setValue: (next: unknown) => {
            value = next;
        }
    };
}

describe('stored UI queries', () => {
    test('reads only the registered stored query and shares its cached read', async () => {
        const r = rig();
        const first = await r.queries.query(r.session, r.payload);
        expect(first.state).toBe('fresh');
        expect(first.value).toEqual({ count: 7 });
        expect(await r.queries.query(r.session, r.payload)).toEqual(first);
        expect(r.counts().reads).toBe(1);
    });
    test('checks revoked access before returning a cached value', async () => {
        const r = rig();
        await r.queries.query(r.session, r.payload);
        r.revoke();
        const reading = await r.queries.query(r.session, r.payload);
        expect(reading.state).toBe('refused');
        expect(reading.value).toBeUndefined();
        expect(r.counts().reads).toBe(1);
    });
    test('refuses a stale block and an invented query', async () => {
        const r = rig();
        expect((await r.queries.query(r.session, { ...r.payload, revision: 'other' })).state).toBe('refused');
        expect((await r.queries.query(r.session, { ...r.payload, query: '$other' })).state).toBe('refused');
        expect(r.counts().reads).toBe(0);
    });
    test('a denied capture survives restart without capturing wider rights', async () => {
        const r = rig();
        r.session.thread.upsert({ ...r.item, uiQueries: { authorChatId: 'chat', access: null, blocks: {} } });
        expect((await r.queries.query(r.session, r.payload)).state).toBe('refused');
        expect(r.counts().captures).toBe(0);
    });
    test('a fork captures the current chat’s rights', async () => {
        const r = rig();
        r.session.thread.upsert({ ...r.item, uiQueries: { authorChatId: 'original', access: { readable: true }, blocks: {} } });
        r.revoke();
        expect((await r.queries.query(r.session, r.payload)).state).toBe('refused');
        expect(r.counts().captures).toBe(1);
    });
    test('validates the host result before it reaches the UI', async () => {
        const r = rig();
        r.setValue({ count: 'bad' });
        const reading = await r.queries.query(r.session, r.payload);
        expect(reading.state).toBe('failed');
        expect(reading.value).toBeUndefined();
    });
    test('a choice receives only the issued query value', async () => {
        const r = rig();
        const reading = await r.queries.query(r.session, r.payload);
        const choice = r.block.nodes[1]!.children[0]!;
        const payload = { ...r.payload, choiceId: choice.id, reads: { $data: reading.readId! } };
        const values = await r.queries.choiceValues(r.session, payload);
        expect(resolveUiChoice(r.block, choice.id, {}, values).context).toBe('Count 7');
        await expect(r.queries.choiceValues(r.session, { ...payload, reads: { $data: 'invented' } })).rejects.toThrow('Refresh');
        r.revoke();
        await expect(r.queries.choiceValues(r.session, payload)).rejects.toThrow('No access');
    });
    test('freezes the first values and fallback in metadata, without logging a second tree', async () => {
        const r = rig();
        r.queries.observe(r.session, r.item, true);
        for (let i = 0; i < 40; i++) {
            await Promise.resolve();
        }
        const item = r.session.thread.get('reply') as ChatAssistantItem;
        expect(item.uiQueries!.blocks.block!.readings.$data!.value).toEqual({ count: 7 });
        expect(item.uiQueries!.blocks.block!.fallback).toContain('Count: 7');
        expect(item.uiQueries!.blocks.block!.fallback).toContain('$data: status');
        expect(r.events.every((event) => event.type === 'delta' && event.uiQueries && !event.ui)).toBe(true);
    });
});

test('a frozen read id survives cache loss and schema defaults after restart', async () => {
    const r = rig();
    r.queries.observe(r.session, r.item, true);
    for (let i = 0; i < 40; i++) {
        await Promise.resolve();
    }
    const item = r.session.thread.get('reply') as ChatAssistantItem;
    const reading = item.uiQueries!.blocks.block!.readings.$data!;
    r.queries.forget('chat');
    const values = await r.queries.choiceValues(r.session, { ...r.payload, choiceId: r.block.nodes[1]!.children[0]!.id, reads: { $data: reading.readId! } });
    expect(values).toEqual({ $data: { count: 7 } });
    const count = r.events.length;
    r.queries.observe(r.session, item, true);
    for (let i = 0; i < 40; i++) {
        await Promise.resolve();
    }
    expect(r.events).toHaveLength(count);
});
