import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { PendingPromptStore } from './pending-prompts.ts';

const ExtraSchema = z.object({
    brief: z.string().min(1).optional(),
    picked: z.object({ skills: z.array(z.string()) }).optional()
});

let dir: string;

beforeEach(async () => {
    dir = join(await mkdtemp(join(tmpdir(), 'adecore-prompts-')), 'prompts');
});

afterEach(async () => {
    await rm(join(dir, '..'), { recursive: true, force: true });
});

test('a prompt is handed out once and never again', async () => {
    const store = new PendingPromptStore({ dir });
    await store.put('p1', 'chat-a', 'say hello');

    expect(store.has('chat-a')).toBe(true);
    expect(await store.take('chat-a')).toEqual({ prompt: 'say hello' });
    expect(await store.take('chat-a')).toBeNull();
    expect(store.has('chat-a')).toBe(false);
});

test('two takers in the same tick cannot both get it', async () => {
    const store = new PendingPromptStore({ dir });
    await store.put('p1', 'chat-a', 'only once');

    const taken = await Promise.all([store.take('chat-a'), store.take('chat-a')]);

    expect(taken.filter((value) => value !== null)).toEqual([{ prompt: 'only once' }]);
});

test('what the host keeps beside the prompt survives a restart, and a taken prompt stays taken', async () => {
    const before = new PendingPromptStore({ dir, extra: ExtraSchema });
    await before.put('p1', 'chat-a', 'use $report', { brief: 'publish it', picked: { skills: ['report'] } });
    await before.put('p1', 'chat-b', 'plain', { brief: undefined });

    const after = new PendingPromptStore({ dir, extra: ExtraSchema });
    await after.load();

    expect(await after.take('chat-a')).toEqual({ prompt: 'use $report', brief: 'publish it', picked: { skills: ['report'] } });
    expect(await after.take('chat-b')).toStrictEqual({ prompt: 'plain' });

    const again = new PendingPromptStore({ dir, extra: ExtraSchema });
    await again.load();

    expect(await again.take('chat-a')).toBeNull();
});

test('prune drops what the host picks and keeps the rest', async () => {
    const store = new PendingPromptStore({ dir });
    await store.put('p1', 'chat-a', 'a');
    await store.put('p1', 'chat-b', 'b');
    await store.put('p2', 'chat-c', 'c');

    await store.prune((entry) => entry.projectId === 'p1' && entry.nodeId !== 'chat-b');

    expect(await store.take('chat-a')).toBeNull();
    expect(await store.take('chat-b')).toEqual({ prompt: 'b' });
    expect(await store.take('chat-c')).toEqual({ prompt: 'c' });
});

test('a file that is not a prompt is ignored rather than thrown over', async () => {
    const store = new PendingPromptStore({ dir });
    await store.put('p1', 'chat-a', 'a');
    await Bun.write(join(store.dir, 'junk.json'), '{ not json');
    await Bun.write(join(store.dir, 'other.json'), JSON.stringify({ nodeId: 'x' }));

    const after = new PendingPromptStore({ dir });
    await after.load();

    expect(await after.take('chat-a')).toEqual({ prompt: 'a' });
    expect(await after.take('x')).toBeNull();
});

test('an id with a slash in it stays inside the folder', async () => {
    const store = new PendingPromptStore({ dir });
    await store.put('p1', '../escape/id', 'a');

    expect(await readdir(store.dir)).toEqual(['..%2Fescape%2Fid.json']);
    expect(await store.take('../escape/id')).toEqual({ prompt: 'a' });
});
