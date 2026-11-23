import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { lstat, mkdir, mkdtemp, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { linkApartEntries } from './apart-links.ts';

describe.skipIf(process.platform === 'win32')('linkApartEntries', () => {
    let dir: string;
    let from: string;
    let into: string;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), 'adecore-apart-links-'));
        from = join(dir, 'gemini');
        into = join(dir, 'account');
        await mkdir(join(from, 'config', 'skills'), { recursive: true });
        await mkdir(into);
        await writeFile(join(from, 'AGENTS.md'), '# rules');
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    test('links what the CLI folder has, nested or not, and leaves out what it lacks', async () => {
        const unshared = await linkApartEntries(from, into, ['config/skills', 'AGENTS.md', 'GEMINI.md']);

        expect(unshared).toEqual([]);
        expect(await readlink(join(into, 'config', 'skills'))).toBe(join(from, 'config', 'skills'));
        expect(await readlink(join(into, 'AGENTS.md'))).toBe(join(from, 'AGENTS.md'));
        await expect(lstat(join(into, 'GEMINI.md'))).rejects.toThrow();
    });

    test("replaces the empty folder the CLI made in a link's place, and keeps one with content", async () => {
        await mkdir(join(into, 'config', 'skills'), { recursive: true });
        await mkdir(join(from, 'antigravity-cli', 'skills'), { recursive: true });
        await mkdir(join(into, 'antigravity-cli', 'skills', 'mine'), { recursive: true });

        const unshared = await linkApartEntries(from, into, ['config/skills', 'antigravity-cli/skills']);

        expect(unshared).toEqual(['antigravity-cli/skills']);
        expect(await readlink(join(into, 'config', 'skills'))).toBe(join(from, 'config', 'skills'));
        expect((await lstat(join(into, 'antigravity-cli', 'skills', 'mine'))).isDirectory()).toBe(true);
    });

    test('removes a link whose entry the CLI folder no longer has', async () => {
        await symlink(join(from, 'GEMINI.md'), join(into, 'GEMINI.md'));

        await linkApartEntries(from, into, ['GEMINI.md']);

        await expect(lstat(join(into, 'GEMINI.md'))).rejects.toThrow();
    });
});
