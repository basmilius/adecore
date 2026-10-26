import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { writeAtomic } from './fs.ts';
import { RecordDirectory, type RecordDirectoryOptions, recordFileName } from './record-directory.ts';

const RecordSchema = z.object({ id: z.string(), text: z.string() });

type Entry = z.infer<typeof RecordSchema>;

let dir: string;

beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ruimte-records-'));
});

afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

/* A removal that holds each delete until the test lets it go, and fails one that starts beside another. */
function gatedRemoval() {
    const started: string[] = [];
    const gates: Array<() => void> = [];
    let pending = 0;
    let onStart: (() => void) | null = null;

    const remove = async (path: string): Promise<void> => {
        if (pending > 0) {
            throw Object.assign(new Error('a delete started while another was pending'), { code: 'EFAULT' });
        }

        pending++;
        started.push(path);
        onStart?.();
        onStart = null;
        const { promise, resolve } = Promise.withResolvers<void>();
        gates.push(resolve);
        await promise;
        pending--;
    };

    const nextStart = (): Promise<void> =>
        new Promise((resolve) => {
            onStart = resolve;
        });

    const release = (): void => {
        gates.shift()?.();
    };

    return { remove, started, nextStart, release };
}

function directory(options: Pick<RecordDirectoryOptions<Entry>, 'remove' | 'write'> = {}): RecordDirectory<Entry> {
    return new RecordDirectory<Entry>({ dir, schema: RecordSchema, idOf: (record) => record.id, ...options });
}

test('two removes of one record run one after the other and both resolve', async () => {
    const removal = gatedRemoval();
    const records = directory({ remove: removal.remove });
    await records.write({ id: 'task-1', text: 'a' });

    const firstStart = removal.nextStart();
    const first = records.remove('task-1');
    const second = records.remove('task-1');
    expect(records.has('task-1')).toBe(false);
    await firstStart;
    expect(removal.started).toEqual([join(dir, recordFileName('task-1'))]);

    const secondStart = removal.nextStart();
    removal.release();
    await expect(first).resolves.toBeUndefined();
    await secondStart;
    expect(removal.started).toHaveLength(2);
    removal.release();
    await expect(second).resolves.toBeUndefined();
});

test('a remove waits for a write of the same record that is still on its way', async () => {
    const removal = gatedRemoval();
    const writing = Promise.withResolvers<void>();
    const written = Promise.withResolvers<void>();

    const records = directory({
        remove: removal.remove,
        write: () => {
            writing.resolve();

            return written.promise;
        }
    });

    const write = records.write({ id: 'task-1', text: 'a' });
    await writing.promise;
    const remove = records.remove('task-1');

    // The write sees the record go and takes its file back with it; the remove comes after that.
    const cleanupStart = removal.nextStart();
    written.resolve();
    await cleanupStart;
    expect(removal.started).toHaveLength(1);

    const removeStart = removal.nextStart();
    removal.release();
    await expect(write).resolves.toBe(false);
    await removeStart;
    expect(removal.started).toHaveLength(2);
    removal.release();
    await expect(remove).resolves.toBeUndefined();
});

test('removes of different records do not wait on each other', async () => {
    const started: string[] = [];
    const { promise: held, resolve: letGo } = Promise.withResolvers<void>();

    const records = directory({
        remove: async (path) => {
            started.push(path);
            await held;
        }
    });

    const first = records.remove('task-1');
    const second = records.remove('task-2');
    await Bun.sleep(0);
    expect(started).toEqual([join(dir, recordFileName('task-1')), join(dir, recordFileName('task-2'))]);

    letGo();
    await Promise.all([first, second]);
});

test('a record written again right after a remove keeps its new file', async () => {
    const records = directory();
    await records.write({ id: 'task-1', text: 'a' });

    const remove = records.remove('task-1');
    const write = records.write({ id: 'task-1', text: 'b' });
    await remove;
    await expect(write).resolves.toBe(true);

    expect(JSON.parse(await readFile(join(dir, recordFileName('task-1')), 'utf8'))).toEqual({ id: 'task-1', text: 'b' });
});

test('a write a remove and a newer write overtook answers false, and the file holds the newer record', async () => {
    const writing = Promise.withResolvers<void>();
    const held = Promise.withResolvers<void>();
    let writes = 0;

    const records = directory({
        write: async (path, text) => {
            writes++;

            if (writes === 1) {
                writing.resolve();
                await held.promise;
            }

            await writeAtomic(path, text);
        }
    });

    const stale = records.write({ id: 'task-1', text: 'a' });
    await writing.promise;
    const remove = records.remove('task-1');
    const fresh = records.write({ id: 'task-1', text: 'b' });
    held.resolve();

    await expect(stale).resolves.toBe(false);
    await remove;
    await expect(fresh).resolves.toBe(true);
    expect(JSON.parse(await readFile(join(dir, recordFileName('task-1')), 'utf8'))).toEqual({ id: 'task-1', text: 'b' });
});
