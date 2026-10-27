import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    CHAT_PAYLOAD_INLINE_BYTES,
    type ChatCheckpointDiff,
    type ChatInfo,
    type ChatItem,
    type ChatToolItem,
    type ChatTurnItem
} from '@adecore/agent-contracts';
import { ChatLog } from './chat-log.ts';
import { ChatStore } from './chat-store.ts';
import { compactItems, PAYLOAD_PREVIEW_BYTES, previewOf } from './payload-store.ts';

function info(): ChatInfo {
    return {
        chatId: 'chat',
        provider: 'claude',
        cwd: '/',
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

function tool(id: string, output: string | null): ChatToolItem {
    return { id, kind: 'tool', createdAt: 1, turnId: 't1', toolUseId: id, name: 'Bash', input: {}, output, state: 'done', parentToolUseId: null };
}

function turn(id: string, diff: ChatCheckpointDiff): ChatTurnItem {
    return { id, kind: 'turn', createdAt: 1, turnId: id, state: 'done', endedAt: 2, costUsd: 0, checkpointDiff: diff };
}

function bigOutput(lines: number): string {
    return Array.from({ length: lines }, (_, index) => `line ${index} ${'x'.repeat(60)}`).join('\n');
}

function fileDiff(path: string, size: number): ChatCheckpointDiff['files'][number] {
    return { path, kind: 'update', added: 1, deleted: 1, diff: `@@ -1 +1 @@\n${'-'.repeat(size)}\n` };
}

let home: string;
let store: ChatStore;

beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'adecore-payload-store-'));
    store = new ChatStore(home);
});

afterEach(async () => {
    await rm(home, { recursive: true, force: true });
});

async function payloadFiles(chatId: string): Promise<string[]> {
    return readdir(join(store.dir, `${chatId}.payloads`)).catch(() => []);
}

describe('previewOf', () => {
    test('keeps a text that fits whole', () => {
        expect(previewOf('short\ntext', 64)).toBe('short\ntext');
    });

    test('ends on the last line break when that keeps at least half', () => {
        expect(previewOf('aaaa\nbbbb\ncccc', 12)).toBe('aaaa\nbbbb\n');
    });

    test('never cuts inside a character', () => {
        const preview = previewOf('ééééé', 5);
        expect(preview).toBe('éé');
        expect(Buffer.byteLength(preview)).toBeLessThanOrEqual(5);
        expect(previewOf('a😀b', 2)).toBe('a');
    });
});

describe('compactItems', () => {
    test('leaves an output within the inline limit as it is', () => {
        const item = tool('small', 'x'.repeat(CHAT_PAYLOAD_INLINE_BYTES));
        const { items, payloads } = compactItems([item]);
        expect(items[0]).toBe(item);
        expect(payloads.size).toBe(0);
    });

    test('cuts an output past the limit to its beginning and names the whole by its bytes', () => {
        const output = bigOutput(2000);
        const { items, payloads } = compactItems([tool('big', output)]);
        const compacted = items[0] as ChatToolItem;
        expect(compacted.outputRef?.bytes).toBe(Buffer.byteLength(output));
        expect(Buffer.byteLength(compacted.output ?? '')).toBeLessThanOrEqual(PAYLOAD_PREVIEW_BYTES);
        expect(output.startsWith(compacted.output ?? '-')).toBe(true);
        expect(compacted.output?.endsWith('\n')).toBe(true);
        expect(payloads.get(compacted.outputRef?.id ?? '')?.()).toBe(output);
    });

    test('keeps every file of a large diff and holds back the diffs past the preview', () => {
        const diff: ChatCheckpointDiff = {
            files: [fileDiff('a.ts', 100), ...Array.from({ length: 20 }, (_, index) => fileDiff(`f${index}.ts`, 4000))],
            truncated: false
        };
        const compacted = compactItems([turn('t1', diff)]).items[0] as ChatTurnItem;
        expect(compacted.checkpointDiff?.files.map((file) => file.path)).toEqual(diff.files.map((file) => file.path));
        expect(compacted.checkpointDiff?.files[0]?.diff).toBe(diff.files[0]?.diff);
        expect(compacted.checkpointDiff?.files.at(-1)?.diff).toBe('');
        expect(compacted.checkpointDiffRef?.bytes).toBe(Buffer.byteLength(JSON.stringify(diff)));
    });
});

describe('ChatStore payloads', () => {
    test('writes a large output apart, compressed, and reads it back whole', async () => {
        const output = bigOutput(5000);
        await store.write('chat', info(), [tool('big', output)]);
        const record = await readFile(join(store.dir, 'chat.json'), 'utf8');
        expect(record.length).toBeLessThan(PAYLOAD_PREVIEW_BYTES * 2);
        const read = await store.read('chat');
        const item = read?.items[0] as ChatToolItem;
        expect(item.outputRef).toBeDefined();
        expect(await store.readPayload('chat', item.outputRef?.id ?? '')).toBe(output);
        const [file] = await payloadFiles('chat');
        const packed = await readFile(join(store.dir, 'chat.payloads', file ?? ''));
        expect(packed.length).toBeLessThan(output.length / 4);
    });

    test('reads a large diff back whole', async () => {
        const diff: ChatCheckpointDiff = { files: Array.from({ length: 30 }, (_, index) => fileDiff(`f${index}.ts`, 4000)), truncated: false };
        await store.write('chat', info(), [turn('t1', diff)]);
        const item = (await store.read('chat'))?.items[0] as ChatTurnItem;
        expect(await store.readDiff('chat', item.checkpointDiffRef?.id ?? '')).toEqual(diff);
    });

    test('moves the large outputs of a record from before out once, and keeps it a record that starts with its info', async () => {
        const output = bigOutput(3000);
        const path = join(store.dir, 'chat.json');
        await store.write('chat', info(), []);
        await writeFile(path, JSON.stringify({ info: info(), items: [tool('big', output)], seq: 4, resetSeq: 0, extra: { kept: true } }));
        const read = await store.read('chat');
        expect((read?.items[0] as ChatToolItem | undefined)?.outputRef).toBeDefined();
        expect(read?.seq).toBe(4);
        expect(read?.extras).toEqual({ extra: { kept: true } });
        const migrated = await readFile(path, 'utf8');
        expect(migrated.startsWith('{"info":{')).toBe(true);
        expect(migrated.length).toBeLessThan(PAYLOAD_PREVIEW_BYTES * 2);
        expect(await store.settled('chat')).toBe(true);
    });

    test('a large output the log holds whole is apart once the chat is read', async () => {
        const output = bigOutput(3000);
        await store.write('chat', info(), [], { seq: 0, resetSeq: 0 });
        const log = new ChatLog(store.logPath('chat'), { seq: 0, resetSeq: 0, lines: [] });
        log.append({ type: 'item', item: tool('big', output) }, 1);
        log.close();
        const item = (await store.read('chat'))?.items[0] as ChatToolItem;
        expect(item.output?.length).toBeLessThan(output.length);
        expect(await store.readPayload('chat', item.outputRef?.id ?? '')).toBe(output);
    });

    test('a fork written from compacted items keeps its payloads when the original goes', async () => {
        const output = bigOutput(3000);
        await store.write('original', info(), [tool('big', output)]);
        const items = (await store.read('original'))?.items ?? [];
        await store.write('fork', info(), items);
        await store.delete('original');
        expect(await payloadFiles('original')).toEqual([]);
        const item = (await store.read('fork'))?.items[0] as ChatToolItem;
        expect(await store.readPayload('fork', item.outputRef?.id ?? '')).toBe(output);
    });

    test('the same output written twice is one file', async () => {
        const output = bigOutput(3000);
        await store.write('chat', info(), [tool('a', output), tool('b', output)]);
        expect(await payloadFiles('chat')).toHaveLength(1);
    });

    test('a prune removes the payloads the last record no longer refers to', async () => {
        await store.write('chat', info(), [tool('a', bigOutput(3000)), tool('b', bigOutput(3001))]);
        expect(await payloadFiles('chat')).toHaveLength(2);
        await store.write('chat', info(), [tool('b', bigOutput(3001))]);
        await store.prunePayloads('chat');
        expect(await payloadFiles('chat')).toHaveLength(1);
        await store.write('chat', info(), []);
        await store.prunePayloads('chat');
        expect(await payloadFiles('chat')).toEqual([]);
    });

    test('a prune before this process wrote the record removes nothing', async () => {
        await store.write('chat', info(), [tool('a', bigOutput(3000))]);
        const fresh = new ChatStore(home);
        await fresh.prunePayloads('chat');
        expect(await payloadFiles('chat')).toHaveLength(1);
    });

    test('a write on the way out puts its payloads down as well', async () => {
        const output = bigOutput(3000);
        store.writeSync('chat', info(), [tool('big', output)]);
        const item = (await new ChatStore(home).read('chat'))?.items[0] as ChatToolItem;
        expect(await new ChatStore(home).readPayload('chat', item.outputRef?.id ?? '')).toBe(output);
    });

    test('a payload that is gone is refused, and an id that is no hash never reaches the disk', async () => {
        await expect(store.readPayload('chat', 'a'.repeat(64))).rejects.toMatchObject({ code: 'payload-missing' });
        await expect(store.readPayload('chat', '../chat')).rejects.toMatchObject({ code: 'payload-missing' });
    });

    test('the payload folder is no chat', async () => {
        await store.write('chat', info(), [tool('big', bigOutput(3000))]);
        expect(await store.list()).toEqual(['chat']);
    });

    test('compacting the same item twice reuses the first answer', () => {
        const item: ChatItem = tool('big', bigOutput(3000));
        expect(compactItems([item]).items[0]).toBe(compactItems([item]).items[0]);
    });
});
