import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as crypto from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entryExists, fileExists, isBusyRename, removeFile, replaceSync, tempNameFor, writeAtomic, writeAtomicSync } from './fs.ts';

let dir: string;

beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'adecore-fs-'));
});

afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

describe('writeAtomic', () => {
    test.each(['normal', 'durable', 'sync'])('leaves a symlink on a temporary name untouched during a %s write', async (variant) => {
        const target = join(dir, 'state.json');
        const outside = join(dir, 'outside.txt');
        await writeFile(outside, 'original');
        const collision = '11111111-1111-4111-8111-111111111111';
        const available = '22222222-2222-4222-8222-222222222222';
        const random = spyOn(crypto, 'randomUUID').mockReturnValue(collision);
        const link = tempNameFor(target);
        try {
            await symlink(outside, link);
            random.mockReturnValueOnce(collision).mockReturnValue(available);

            if (variant === 'sync') {
                writeAtomicSync(target, 'new');
            } else {
                await writeAtomic(target, 'new', 0o600, { durable: variant === 'durable' });
            }
        } finally {
            random.mockRestore();
        }

        expect(await readFile(outside, 'utf8')).toBe('original');
        expect(await readFile(target, 'utf8')).toBe('new');
        expect(await entryExists(link)).toBe(true);
    });

    test('a durable write replaces the file whole, with its mode, and leaves no temp file behind', async () => {
        const target = join(dir, 'project.json');
        await writeFile(target, 'old');

        await writeAtomic(target, '{"rev":2}\n', 0o644, { durable: true });

        expect(await readFile(target, 'utf8')).toBe('{"rev":2}\n');
        expect(await readdir(dir)).toEqual(['project.json']);

        if (process.platform !== 'win32') {
            // A new file takes the mode it is created with, and the temp file is a new file.
            expect((await stat(target)).mode & 0o777).toBe(0o644);
        }
    });

    test('a durable write takes bytes as well as text', async () => {
        const target = join(dir, 'icon.png');
        await writeAtomic(target, new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 0o600, { durable: true });
        expect([...(await readFile(target))]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    });
});

describe('entryExists', () => {
    test('counts a link that leads nowhere, which fileExists does not', async () => {
        const link = join(dir, 'dangling');
        await symlink(join(dir, 'missing'), link);

        expect(await entryExists(link)).toBe(true);
        expect(await fileExists(link)).toBe(false);
        expect(await entryExists(join(dir, 'missing'))).toBe(false);
    });
});

describe('removeFile', () => {
    const failing = (code: string) => async (): Promise<void> => {
        throw Object.assign(new Error(code), { code });
    };

    test('counts EFAULT from a pending delete as removed', async () => {
        await expect(removeFile(join(dir, 'record.json'), failing('EFAULT'))).resolves.toBeUndefined();
    });

    test('passes on every other error', async () => {
        await expect(removeFile(join(dir, 'record.json'), failing('EACCES'))).rejects.toMatchObject({ code: 'EACCES' });
    });

    test('removes the file and leaves a missing one alone', async () => {
        const target = join(dir, 'record.json');
        await writeFile(target, '{}');
        await removeFile(target);
        await removeFile(target);
        expect(await readdir(dir)).toEqual([]);
    });
});

describe('isBusyRename', () => {
    test('counts a file another process holds, never running out of descriptors', () => {
        const coded = (code: string) => Object.assign(new Error(code), { code });

        expect(['EPERM', 'EBUSY', 'EACCES'].map((code) => isBusyRename(coded(code)))).toEqual([true, true, true]);
        expect(['EMFILE', 'ENFILE', 'ENOENT'].map((code) => isBusyRename(coded(code)))).toEqual([false, false, false]);
    });
});

describe('replaceSync', () => {
    test('moves the file over the target', async () => {
        const temp = join(dir, 'next.tmp');
        const target = join(dir, 'state.json');
        await writeFile(temp, 'new');
        await writeFile(target, 'old');

        replaceSync(temp, target);

        expect(await readFile(target, 'utf8')).toBe('new');
        expect(await readdir(dir)).toEqual(['state.json']);
    });
});
