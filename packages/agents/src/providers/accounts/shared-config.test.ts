import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { lstat, mkdir, mkdtemp, readdir, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claudeProvider } from '../../testing/providers.ts';
import type { ProviderShare } from '../provider.ts';
import { applySharedConfig, removeSharedConfig } from './shared-config.ts';

const share = claudeProvider.home!.share!;

const SETTINGS = {
    permissions: { allow: ['Bash(ls)'] },
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] },
    model: 'opus',
    statusLine: { type: 'command', command: 'echo hi' },
    outputStyle: 'Explanatory',
    env: { ANTHROPIC_API_KEY: 'sk-ant-secret' },
    apiKeyHelper: '/bin/key-helper',
    theme: 'dark'
};

const HOOKS_ONLY = { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'host --marker' }] }] } };

const hostOwns = (config: unknown): boolean => {
    const keys = Object.keys((config ?? {}) as Record<string, unknown>);

    return keys.length === 1 && keys[0] === 'hooks';
};

describe('applySharedConfig', () => {
    let dir: string;
    let home: string;
    let own: string;

    const settingsOf = async (folder: string): Promise<Record<string, unknown>> => JSON.parse(await readFile(join(folder, 'settings.json'), 'utf8'));

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), 'adecore-shared-config-'));
        home = join(dir, 'claude');
        own = join(dir, 'claude_work');
        await mkdir(join(home, 'skills'), { recursive: true });
        await mkdir(join(home, 'agents'));
        await mkdir(join(home, 'commands'));
        await mkdir(join(home, 'rules'));
        await mkdir(join(home, 'output-styles'));
        await mkdir(own);
        await writeFile(join(home, 'CLAUDE.md'), '# mine');
        await writeFile(join(home, 'settings.json'), JSON.stringify(SETTINGS));
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    test('links every shared entry into a fresh folder, and a second run changes nothing', async () => {
        const first = await applySharedConfig(home, own, share);

        expect(first.linked).toEqual(['CLAUDE.md', 'rules', 'skills', 'agents', 'commands', 'output-styles']);
        expect(first.unshared).toEqual([]);
        expect(await readlink(join(own, 'skills'))).toBe(join(home, 'skills'));
        expect(await readFile(join(own, 'CLAUDE.md'), 'utf8')).toBe('# mine');

        const second = await applySharedConfig(home, own, share);

        expect(second).toEqual({ linked: [], unshared: [], seeded: false });
    });

    test('picks up an entry the default folder gained since', async () => {
        await rm(join(home, 'commands'), { recursive: true });
        await applySharedConfig(home, own, share);
        await mkdir(join(home, 'commands'));

        expect((await applySharedConfig(home, own, share)).linked).toEqual(['commands']);
    });

    test('leaves a real file or a link elsewhere where it is and names it', async () => {
        await writeFile(join(own, 'CLAUDE.md'), '# own');
        await symlink(join(dir, 'elsewhere'), join(own, 'skills'));

        const report = await applySharedConfig(home, own, share);

        expect(report.unshared).toEqual(['CLAUDE.md', 'skills']);
        expect(report.linked).toEqual(['rules', 'agents', 'commands', 'output-styles']);
        expect(await readFile(join(own, 'CLAUDE.md'), 'utf8')).toBe('# own');
        expect(await readlink(join(own, 'skills'))).toBe(join(dir, 'elsewhere'));
    });

    test('skips an entry the default folder lacks and creates nothing in it', async () => {
        await rm(join(home, 'rules'), { recursive: true });
        const before = (await readdir(home)).sort();

        const report = await applySharedConfig(home, own, share);

        expect(report.linked).not.toContain('rules');
        expect(lstat(join(own, 'rules'))).rejects.toThrow();
        expect((await readdir(home)).sort()).toEqual(before);
    });

    test('copies only the listed keys of the settings', async () => {
        const report = await applySharedConfig(home, own, share);

        expect(report.seeded).toBe(true);
        expect(await settingsOf(own)).toEqual({
            permissions: SETTINGS.permissions,
            hooks: SETTINGS.hooks,
            model: 'opus',
            statusLine: SETTINGS.statusLine,
            outputStyle: 'Explanatory'
        });
        // Windows keeps no POSIX mode bits, so only the other platforms can show the file is private.
        if (process.platform !== 'win32') {
            expect((await lstat(join(own, 'settings.json'))).mode & 0o777).toBe(0o600);
        }
    });

    test('links the output styles, so a custom style the copied settings name is there', async () => {
        await writeFile(join(home, 'output-styles', 'terse.md'), '---\nname: Terse\n---\n');
        await writeFile(join(home, 'settings.json'), JSON.stringify({ ...SETTINGS, outputStyle: 'Terse' }));

        await applySharedConfig(home, own, share);

        expect((await settingsOf(own)).outputStyle).toBe('Terse');
        expect(await readFile(join(own, 'output-styles', 'terse.md'), 'utf8')).toContain('name: Terse');
    });

    test('leaves a settings file the host does not own alone', async () => {
        await writeFile(join(own, 'settings.json'), JSON.stringify(HOOKS_ONLY));

        expect((await applySharedConfig(home, own, share)).seeded).toBe(false);
        expect(await settingsOf(own)).toEqual(HOOKS_ONLY);
    });

    test('replaces a settings file that holds only what the host wrote, and then leaves the copy alone', async () => {
        await writeFile(join(own, 'settings.json'), JSON.stringify(HOOKS_ONLY));

        expect((await applySharedConfig(home, own, share, hostOwns)).seeded).toBe(true);
        expect((await settingsOf(own)).model).toBe('opus');

        await writeFile(join(own, 'settings.json'), JSON.stringify({ model: 'sonnet', hooks: HOOKS_ONLY.hooks }));

        expect((await applySharedConfig(home, own, share, hostOwns)).seeded).toBe(false);
        expect((await settingsOf(own)).model).toBe('sonnet');
    });

    test('keeps a settings file it cannot read, which the host is asked about as undefined', async () => {
        const asked: unknown[] = [];
        await writeFile(join(own, 'settings.json'), '{ not json');

        const report = await applySharedConfig(home, own, share, (config) => {
            asked.push(config);

            return false;
        });

        expect(report.seeded).toBe(false);
        expect(asked).toEqual([undefined]);
        expect(await readFile(join(own, 'settings.json'), 'utf8')).toBe('{ not json');
    });

    test('writes nothing when the default account has no settings to take', async () => {
        await rm(join(home, 'settings.json'));

        expect((await applySharedConfig(home, own, share)).seeded).toBe(false);
        expect(lstat(join(own, 'settings.json'))).rejects.toThrow();
    });

    test('never lets a login, a history or a plugin near the account', async () => {
        for (const name of ['.credentials.json', '.claude.json', 'history.jsonl']) {
            await writeFile(join(home, name), '{}');
        }

        for (const name of ['projects', 'plugins', 'todos']) {
            await mkdir(join(home, name));
        }

        await applySharedConfig(home, own, share);

        expect((await readdir(own)).sort()).toEqual(['CLAUDE.md', 'agents', 'commands', 'output-styles', 'rules', 'settings.json', 'skills']);
    });

    test('shares nothing a provider does not list', async () => {
        const narrow: ProviderShare = { links: ['skills'], seed: { file: 'settings.json', keys: ['model'] } };

        await applySharedConfig(home, own, narrow);

        expect((await readdir(own)).sort()).toEqual(['settings.json', 'skills']);
        expect(await settingsOf(own)).toEqual({ model: 'opus' });
    });
});

describe('removeSharedConfig', () => {
    let dir: string;
    let home: string;
    let own: string;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), 'adecore-shared-config-'));
        home = join(dir, 'claude');
        own = join(dir, 'claude_work');
        await mkdir(join(home, 'skills'), { recursive: true });
        await mkdir(join(home, 'agents'));
        await writeFile(join(home, 'CLAUDE.md'), '# mine');
        await writeFile(join(home, 'settings.json'), JSON.stringify(SETTINGS));
        await mkdir(own);
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    test('removes only its own links and leaves real files, other links and the copied settings', async () => {
        await writeFile(join(own, 'CLAUDE.md'), '# own');
        await symlink(join(dir, 'elsewhere'), join(own, 'agents'));
        await applySharedConfig(home, own, claudeProvider.home!.share!);

        const removed = await removeSharedConfig(home, own, claudeProvider.home!.share!);

        expect(removed).toEqual(['skills']);
        expect(lstat(join(own, 'skills'))).rejects.toThrow();
        expect(await readFile(join(own, 'CLAUDE.md'), 'utf8')).toBe('# own');
        expect(await readlink(join(own, 'agents'))).toBe(join(dir, 'elsewhere'));
        expect(JSON.parse(await readFile(join(own, 'settings.json'), 'utf8')).model).toBe('opus');
        expect(await readFile(join(home, 'CLAUDE.md'), 'utf8')).toBe('# mine');
    });
});
