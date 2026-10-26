import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { discoverSkills, mapLimited, parseFrontmatter, pluginSkillRoots, scanSkillRoots, SkillIndex, whileBusy } from './skills.ts';

let home = '';
let project = '';

async function writeSkill(dir: string, folder: string, body: string): Promise<void> {
    await mkdir(join(dir, folder), { recursive: true });
    await writeFile(join(dir, folder, 'SKILL.md'), body);
}

beforeAll(async () => {
    home = await mkdtemp(join(tmpdir(), 'ruimte-skills-'));
    project = join(home, 'work', 'app');
    await mkdir(join(project, 'src'), { recursive: true });
    await writeFile(join(home, 'work', 'app', '.git'), 'gitdir: elsewhere');

    await writeSkill(join(home, '.claude', 'skills'), 'unslop', '---\nname: unslop\ndescription: Edit prose.\n---\n\nBody.\n');
    await writeSkill(join(home, '.claude', 'skills'), 'folded', '---\nname: folded\ndescription: >-\n  A long one\n  over two lines.\n---\n');
    // No front matter name, so the folder names the skill.
    await writeSkill(join(home, '.claude', 'skills'), 'nameless', '# Nameless\n');
    await writeSkill(join(project, '.claude', 'skills'), 'deploy', '---\nname: deploy\ndescription: Ship it.\n---\n');
    await writeSkill(join(home, '.agents', 'skills'), 'oklch', '---\nname: oklch\ndescription: Colors.\n---\n');
    await writeSkill(join(project, '.agents', 'skills'), 'codex-only', '---\nname: codex-only\ndescription: For Codex.\n---\n');
    await writeSkill(join(home, 'shared'), 'linked', '---\nname: linked\ndescription: Linked in.\n---\n');
    await symlink(join(home, 'shared', 'linked'), join(home, '.claude', 'skills', 'linked'));

    const install = join(home, '.claude', 'plugins', 'cache', 'frontend-design');
    await writeSkill(join(install, 'skills'), 'frontend-design', '---\nname: frontend-design\ndescription: Visual design.\n---\n');
    await mkdir(join(home, '.claude', 'plugins'), { recursive: true });

    await writeFile(
        join(home, '.claude', 'plugins', 'installed_plugins.json'),
        JSON.stringify({ version: 2, plugins: { 'frontend-design@official': [{ scope: 'user', installPath: install }] } })
    );
});

afterAll(async () => {
    await rm(home, { recursive: true, force: true });
});

describe('parseFrontmatter', () => {
    test('reads plain keys and strips quotes', () => {
        expect(parseFrontmatter('---\nname: "a b"\ndescription: c\n---\nbody')).toEqual({ name: 'a b', description: 'c' });
    });

    test('folds a block scalar onto one line and keeps a literal one', () => {
        expect(parseFrontmatter('---\ndescription: >-\n  one\n  two\n---\n').description).toBe('one two');
        expect(parseFrontmatter('---\ndescription: |\n  one\n  two\n---\n').description).toBe('one\ntwo');
    });

    test('a file without front matter has no fields', () => {
        expect(parseFrontmatter('# Title\n')).toEqual({});
    });
});

describe('discoverSkills', () => {
    test('Claude sees the user folder, the project folder and the plugins', async () => {
        const skills = await discoverSkills('claude', join(project, 'src'), { home });
        expect(skills.map((skill) => skill.name)).toEqual(['deploy', 'folded', 'frontend-design:frontend-design', 'linked', 'nameless', 'unslop']);
        expect(skills.find((skill) => skill.name === 'deploy')?.source).toBe('project');
        expect(skills.find((skill) => skill.name === 'unslop')?.source).toBe('user');
        expect(skills.find((skill) => skill.name === 'frontend-design:frontend-design')?.source).toBe('plugin');
    });

    test('a skill folder linked in from elsewhere is a user skill', async () => {
        const skills = await discoverSkills('claude', project, { home });
        expect(skills.find((skill) => skill.name === 'linked')?.source).toBe('user');
    });

    test('a folded description comes back as one line', async () => {
        const skills = await discoverSkills('claude', project, { home });
        expect(skills.find((skill) => skill.name === 'folded')?.description).toBe('A long one over two lines.');
    });

    test('a folder without a name in its front matter is named after the folder', async () => {
        const skills = await discoverSkills('claude', project, { home });
        expect(skills.find((skill) => skill.name === 'nameless')?.description).toBe('');
    });

    test('Codex looks in its own roots and never in Claude`s', async () => {
        const skills = await discoverSkills('codex', project, { home });
        expect(skills.map((skill) => skill.name)).toEqual(['codex-only', 'oklch']);
    });

    test('a folder with nothing in it answers nothing', async () => {
        expect(await discoverSkills('claude', join(home, 'empty'), { home, claudeConfigDir: join(home, 'nowhere') })).toEqual([]);
    });
});

describe('a bounded scan', () => {
    let tree = '';

    const skill = (name: string): string => `---\nname: ${name}\ndescription: ${name}.\n---\n`;

    const names = (skills: Array<{ name: string }>): string[] => skills.map((found) => found.name);

    beforeAll(async () => {
        tree = await mkdtemp(join(tmpdir(), 'adecore-skill-scan-'));
    });

    afterAll(async () => {
        await rm(tree, { recursive: true, force: true });
    });

    test('never searches a dependency or build folder, and a hidden one not at all', async () => {
        const root = join(tree, 'deps');
        await writeSkill(join(root, 'tools'), 'helper', skill('helper'));
        await writeSkill(join(root, 'tools', 'node_modules', 'package'), 'bundled', skill('bundled'));
        await writeSkill(join(root, 'dist', 'copy'), 'copied', skill('copied'));
        await writeSkill(join(root, '.cache'), 'hidden', skill('hidden'));
        // A skill that is itself named like a build folder still counts.
        await writeSkill(root, 'build', skill('build'));
        expect(names(await scanSkillRoots([{ dir: root, source: 'project', depth: 5 }]))).toEqual(['build', 'helper']);
    });

    test('reads a root that a link leads to under every root, each by its own name', async () => {
        const root = join(tree, 'shared');
        await writeSkill(root, 'review', skill('review'));
        await symlink(root, join(tree, 'shared-link'));

        const skills = await scanSkillRoots([
            { dir: root, source: 'user' },
            { dir: join(tree, 'shared-link'), source: 'plugin', prefix: 'linked' },
            { dir: join(tree, 'shared-link'), source: 'project' }
        ]);

        expect(skills).toEqual([
            { name: 'linked:review', description: 'review.', source: 'plugin' },
            { name: 'review', description: 'review.', source: 'user' }
        ]);
    });

    test('shows a skill two plugins link in under each of them', async () => {
        const shared = join(tree, 'plugin-shared');
        await writeSkill(shared, 'lint', skill('lint'));

        for (const plugin of ['one', 'two']) {
            await mkdir(join(tree, 'plugins', plugin), { recursive: true });
            await symlink(join(shared, 'lint'), join(tree, 'plugins', plugin, 'lint'));
        }

        const skills = await scanSkillRoots([
            { dir: join(tree, 'plugins', 'one'), source: 'plugin', prefix: 'one' },
            { dir: join(tree, 'plugins', 'two'), source: 'plugin', prefix: 'two' }
        ]);

        expect(names(skills)).toEqual(['one:lint', 'two:lint']);
    });

    test('a folder one root passed by without reading it is still read by a root that leads there', async () => {
        const root = join(tree, 'passed');
        await writeSkill(join(root, 'node_modules'), 'bundled', skill('bundled'));
        await writeSkill(join(root, 'edge', 'below'), 'deeper', skill('deeper'));

        const skills = await scanSkillRoots([
            { dir: root, source: 'project', depth: 2 },
            { dir: join(root, 'node_modules'), source: 'user' },
            { dir: join(root, 'edge', 'below'), source: 'user' }
        ]);

        expect(names(skills)).toEqual(['bundled', 'deeper']);
    });

    test('looks at a bounded number of entries in one folder, by name', async () => {
        const root = join(tree, 'wide');

        for (const name of ['alpha', 'beta', 'gamma']) {
            await writeSkill(root, name, skill(name));
        }

        expect(names(await scanSkillRoots([{ dir: root, source: 'user' }], { directories: 10, skills: 10, entries: 2 }))).toEqual(['alpha', 'beta']);
    });

    test('ends a link back up the tree, which costs none of the folders a skill further on needs', async () => {
        const root = join(tree, 'cycle');
        await mkdir(join(root, 'a-loop'), { recursive: true });
        await symlink(root, join(root, 'a-loop', 'back'));
        await writeSkill(join(root, 'b', 'c', 'd'), 'far', skill('far'));
        expect(names(await scanSkillRoots([{ dir: root, source: 'user', depth: 5 }], { directories: 5, skills: 10 }))).toEqual(['far']);
    });

    test('keeps to the depth, and a deep tree hides none of the skills nearer the root', async () => {
        const root = join(tree, 'deep');
        let deep = join(root, 'a-tree');

        for (let level = 0; level < 8; level++) {
            await mkdir(join(deep, 'side'), { recursive: true });
            deep = join(deep, 'down');
        }

        await writeSkill(deep, 'too-deep', skill('too-deep'));
        await writeSkill(join(root, 'z-group'), 'near', skill('near'));
        expect(names(await scanSkillRoots([{ dir: root, source: 'user', depth: 5 }]))).toEqual(['near']);
        // Nearest first: the three folders it may list reach the skill before the tree beside it.
        expect(names(await scanSkillRoots([{ dir: root, source: 'user', depth: 5 }], { directories: 3, skills: 10 }))).toEqual(['near']);
        // A root without a depth only looks right under it.
        expect(await scanSkillRoots([{ dir: root, source: 'user' }])).toEqual([]);
    });

    test('answers at most the skills its limit allows, each with a description of bounded length', async () => {
        const root = join(tree, 'many');

        for (const name of ['one', 'two', 'three']) {
            await writeSkill(root, name, `---\nname: ${name}\ndescription: ${'x'.repeat(5000)}\n---\n`);
        }

        const skills = await scanSkillRoots([{ dir: root, source: 'user' }], { directories: 10, skills: 2 });
        expect(skills).toHaveLength(2);
        expect(skills.every((found) => found.description.length === 1024)).toBe(true);
    });

    test('Codex finds a skill grouped in a folder of its own', async () => {
        const codexHome = join(tree, 'codex-home');
        await writeSkill(join(codexHome, '.codex', 'skills', 'team'), 'grouped', skill('grouped'));
        expect(names(await discoverSkills('codex', join(tree, 'nowhere'), { home: codexHome }))).toEqual(['grouped']);
    });
});

describe('a scan short of file handles', () => {
    const busy = () => Object.assign(new Error('too many open files'), { code: 'EMFILE' });

    const noWait = async (): Promise<void> => {};

    test('tries again while the process has too many files open', async () => {
        let calls = 0;

        const answer = await whileBusy(async () => {
            calls++;

            if (calls < 3) {
                throw busy();
            }

            return 'read';
        }, noWait);

        expect(answer).toBe('read');
        expect(calls).toBe(3);
    });

    test('reports a lack of file handles that lasts, and any other error at once', async () => {
        let calls = 0;

        const always = whileBusy(async () => {
            calls++;

            throw busy();
        }, noWait);

        await expect(always).rejects.toMatchObject({ code: 'EMFILE' });
        expect(calls).toBe(4);
        calls = 0;

        const missing = whileBusy(async () => {
            calls++;

            throw Object.assign(new Error('missing'), { code: 'ENOENT' });
        }, noWait);

        await expect(missing).rejects.toMatchObject({ code: 'ENOENT' });
        expect(calls).toBe(1);
    });

    test('runs at most so many at once and answers in order', async () => {
        let running = 0;
        let most = 0;

        const doubled = await mapLimited([1, 2, 3, 4, 5, 6, 7], 3, async (value) => {
            running++;
            most = Math.max(most, running);
            await Promise.resolve();
            running--;

            return value * 2;
        });

        expect(doubled).toEqual([2, 4, 6, 8, 10, 12, 14]);
        expect(most).toBe(3);
    });
});

describe('pluginSkillRoots', () => {
    test('a missing plugin file is not an error', async () => {
        expect(await pluginSkillRoots(join(home, 'nowhere'))).toEqual([]);
    });
});

describe('SkillIndex', () => {
    test('keeps a scan for a while and reads the disk again once a folder is forgotten', async () => {
        const index = new SkillIndex({ home });
        const before = await index.list('claude', project);
        await writeSkill(join(project, '.claude', 'skills'), 'fresh', '---\nname: fresh\ndescription: New.\n---\n');
        expect(await index.list('claude', project)).toEqual(before);
        index.forget('claude', project);
        expect((await index.list('claude', project)).map((skill) => skill.name)).toContain('fresh');
        await rm(join(project, '.claude', 'skills', 'fresh'), { recursive: true });
    });
});
