import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { entryExists, fileExists, hasErrorCode, removeFile, writeAtomic } from './fs.ts';

let dir: string;

beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ruimte-fs-'));
});

afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

describe('writeAtomic', () => {
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

describe('hasErrorCode', () => {
    test('matches the code of an error against any of the codes given', () => {
        const error = Object.assign(new Error('gone'), { code: 'ENOENT' });

        expect(hasErrorCode(error, 'ENOENT')).toBe(true);
        expect(hasErrorCode(error, 'EXDEV', 'ENOENT')).toBe(true);
        expect(hasErrorCode(error, 'EXDEV')).toBe(false);
    });

    test('is false for a value without a code', () => {
        expect(hasErrorCode(new Error('plain'), 'ENOENT')).toBe(false);
        expect(hasErrorCode(null, 'ENOENT')).toBe(false);
        expect(hasErrorCode('ENOENT', 'ENOENT')).toBe(false);
    });
});
