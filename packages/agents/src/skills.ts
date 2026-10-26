import { existsSync, type Dirent } from 'node:fs';
import { open, readdir, readFile, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, parse } from 'node:path';
import type { AgentKind, ChatSkill, ChatSkillSource } from '@adecore/agent-contracts';
import { wait } from './async.ts';
import { hasErrorCode, isNotFound } from './fs.ts';

export interface SkillRoot {
    dir: string;
    source: ChatSkillSource;
    // A plugin names its skills `<plugin>:<skill>`, the way the CLI's init frame does.
    prefix?: string;
    // How many folders below `dir` a skill folder may sit; absent is one, right under it.
    depth?: number;
}

/* How far one scan reaches, so a home or a project of any size answers quickly. */
export interface SkillScanLimits {
    // Folders listed under one root, nearest first, so a deep tree never costs the skills near the top.
    directories: number;
    skills: number;
    // Entries of one folder looked at, by name; absent is `ENTRIES_PER_FOLDER`.
    entries?: number;
}

const SCAN_LIMITS: SkillScanLimits = { directories: 2000, skills: 1000 };

const ENTRIES_PER_FOLDER = 1000;

// Paths one folder resolves or reads at once, so a large folder never runs the process out of file handles.
const SCAN_CONCURRENCY = 16;

// A process short of file handles gets them back as other work closes its files, so a few short waits cover it.
const BUSY_RETRIES = 3;
const BUSY_RETRY_MS = 50;

// Codex finds skills up to five folders below a root (`MAX_SCAN_DEPTH` of 6 in its skill loader counts the root itself).
const CODEX_SKILL_DEPTH = 5;

// Folders a package manager or a build fills. One may hold a SKILL.md of its own, but nothing under it is listed.
const DEPENDENCY_FOLDERS = new Set([
    'node_modules',
    'bower_components',
    'jspm_packages',
    'vendor',
    'Pods',
    'Carthage',
    'DerivedData',
    '__pycache__',
    'venv',
    'site-packages',
    'target',
    'dist',
    'build',
    'out',
    'coverage'
]);

// What a scan reads of a SKILL.md; the front matter sits at its top.
const HEAD_BYTES = 64 * 1024;

const MAX_DESCRIPTION = 1024;

export interface SkillRootOptions {
    home?: string;
    // Where Claude Code keeps its own configuration, when it is not `<home>/.claude`.
    claudeConfigDir?: string;
}

const NAME = /^[A-Za-z][A-Za-z0-9_:-]*$/;

function unquote(value: string): string {
    const quoted = /^(['"])([\s\S]*)\1$/.exec(value);
    return quoted ? quoted[2]! : value;
}

/*
 * The `key: value` pairs of a SKILL.md front matter. Enough YAML for what a skill file holds: flat
 * keys, quoted or bare values, and the block scalars (`>-`, `|`) a long description is written as.
 */
export function parseFrontmatter(text: string): Record<string, string> {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (!match) {
        return {};
    }
    const fields: Record<string, string> = {};
    const lines = match[1]!.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const pair = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(lines[i]!);
        if (!pair) {
            continue;
        }
        let value = pair[2]!.trim();
        if (value === '' || value === '>' || value === '>-' || value === '|' || value === '|-') {
            // A block scalar puts the value on the indented lines under it; `|` keeps the newlines.
            const keepNewlines = value.startsWith('|');
            const parts: string[] = [];
            while (i + 1 < lines.length && /^[ \t]+\S/.test(lines[i + 1]!)) {
                parts.push(lines[++i]!.trim());
            }
            value = parts.join(keepNewlines ? '\n' : ' ');
        }
        fields[pair[1]!] = unquote(value);
    }
    return fields;
}

/*
 * The folders from `cwd` up to and including the repository root, closest first. The home folder
 * itself is not one of them, since its `.claude/skills` is already the user root.
 */
function projectDirs(cwd: string, home: string): string[] {
    const dirs: string[] = [];
    let current = cwd;
    while (current !== '' && current !== parse(current).root && current !== home && current !== dirname(home) && dirs.length < 8) {
        dirs.push(current);
        // Anything above a repository root belongs to another project, so the walk ends there.
        if (existsSync(join(current, '.git'))) {
            break;
        }
        const parent = dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return dirs;
}

/* The plugin folders Claude Code installed, each named the way its skills are addressed. */
export async function pluginSkillRoots(configDir: string): Promise<SkillRoot[]> {
    let raw: string;
    try {
        raw = await readFile(join(configDir, 'plugins', 'installed_plugins.json'), 'utf8');
    } catch (e) {
        if (isNotFound(e)) {
            return [];
        }
        throw e;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return [];
    }
    const plugins = typeof parsed === 'object' && parsed !== null ? (parsed as { plugins?: unknown }).plugins : undefined;
    if (typeof plugins !== 'object' || plugins === null) {
        return [];
    }
    const roots: SkillRoot[] = [];
    for (const [key, installs] of Object.entries(plugins as Record<string, unknown>)) {
        const name = key.split('@')[0] ?? key;
        for (const install of Array.isArray(installs) ? installs : []) {
            const path = typeof install === 'object' && install !== null ? (install as { installPath?: unknown }).installPath : undefined;
            if (typeof path === 'string' && path !== '') {
                roots.push({ dir: join(path, 'skills'), source: 'plugin', prefix: name });
            }
        }
    }
    return roots;
}

/* Where a provider's CLI looks for skills, in the order a name clash is decided. */
export async function skillRootsFor(kind: AgentKind, cwd: string, options: SkillRootOptions = {}): Promise<SkillRoot[]> {
    const home = options.home ?? homedir();
    if (kind === 'codex') {
        return [
            { dir: join(home, '.agents', 'skills'), source: 'user', depth: CODEX_SKILL_DEPTH },
            { dir: join(home, '.codex', 'skills'), source: 'user', depth: CODEX_SKILL_DEPTH },
            ...projectDirs(cwd, home).map((dir): SkillRoot => ({ dir: join(dir, '.agents', 'skills'), source: 'project', depth: CODEX_SKILL_DEPTH }))
        ];
    }
    const configDir = options.claudeConfigDir ?? join(home, '.claude');
    return [
        { dir: join(configDir, 'skills'), source: 'user' },
        ...projectDirs(cwd, home).map((dir): SkillRoot => ({ dir: join(dir, '.claude', 'skills'), source: 'project' })),
        ...(await pluginSkillRoots(configDir))
    ];
}

/* Too many files open, in this process or on the system: it says nothing about the path that was asked for. */
function isBusy(e: unknown): boolean {
    return hasErrorCode(e, 'EMFILE', 'ENFILE');
}

/* Runs `operation` again a few times while the process is short of file handles, and throws if it still is. */
export async function whileBusy<T>(operation: () => Promise<T>, sleep: (ms: number) => Promise<void> = wait): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await operation();
        } catch (e) {
            if (!isBusy(e) || attempt > BUSY_RETRIES) {
                throw e;
            }
            await sleep(BUSY_RETRY_MS * attempt);
        }
    }
}

/* `work` over every item with at most `limit` running at once, answered in the order of `items`. */
export async function mapLimited<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < items.length) {
            const index = next++;
            results[index] = await work(items[index]!);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

/* The top of a folder's SKILL.md, or null when it has none. A process short of file handles throws instead of finding none. */
async function skillHead(folder: string): Promise<string | null> {
    let handle;
    try {
        handle = await whileBusy(() => open(join(folder, 'SKILL.md'), 'r'));
    } catch (e) {
        if (isBusy(e)) {
            throw e;
        }
        return null;
    }
    try {
        if (!(await handle.stat()).isFile()) {
            return null;
        }
        const buffer = Buffer.alloc(HEAD_BYTES);
        const { bytesRead } = await handle.read(buffer, 0, HEAD_BYTES, 0);
        return buffer.subarray(0, bytesRead).toString('utf8');
    } catch {
        return null;
    } finally {
        await handle.close();
    }
}

function skillOf(root: SkillRoot, folder: string, text: string): ChatSkill | null {
    const fields = parseFrontmatter(text);
    const own = fields.name && NAME.test(fields.name) ? fields.name : folder;
    const name = root.prefix ? `${root.prefix}:${own}` : own;
    if (!NAME.test(name)) {
        return null;
    }
    return { name, description: (fields.description ?? '').slice(0, MAX_DESCRIPTION), source: root.source };
}

/* The folder a path leads to after every link, or null when it leads to no folder. */
async function realFolder(path: string): Promise<string | null> {
    try {
        const real = await whileBusy(() => realpath(path));
        return (await whileBusy(() => stat(real))).isDirectory() ? real : null;
    } catch (e) {
        if (isBusy(e)) {
            throw e;
        }
        return null;
    }
}

/*
 * The skills under one root, nearest first, down to the root's depth. A folder with a SKILL.md is a skill and is not
 * searched further. Each root keeps its own record of the folders it read or went into, by real path, so a link back
 * up ends there, while a skill two plugins link in shows under each of them.
 */
async function scanRoot(root: SkillRoot, limits: SkillScanLimits): Promise<ChatSkill[]> {
    const start = await realFolder(root.dir);
    if (start === null) {
        return [];
    }
    const visited = new Set([start]);
    const depth = root.depth ?? 1;
    const entriesPerFolder = limits.entries ?? ENTRIES_PER_FOLDER;
    const skills: ChatSkill[] = [];
    let level = [root.dir];
    let listed = 0;
    for (let below = 1; below <= depth && level.length > 0; below++) {
        const next: string[] = [];
        for (const folder of level) {
            if (listed >= limits.directories || skills.length >= limits.skills) {
                return skills;
            }
            listed++;
            let entries: Dirent[];
            try {
                entries = await whileBusy(() => readdir(folder, { withFileTypes: true }));
            } catch (e) {
                if (isBusy(e)) {
                    throw e;
                }
                continue;
            }
            // A skill manager links each skill in from a shared folder, so a link counts as much as a folder.
            const candidates = entries
                .filter((entry) => (entry.isDirectory() || entry.isSymbolicLink()) && !entry.name.startsWith('.'))
                .map((entry) => ({ name: entry.name, path: join(folder, entry.name) }))
                .sort((a, b) => a.name.localeCompare(b.name))
                .slice(0, entriesPerFolder);
            const reals = await mapLimited(candidates, SCAN_CONCURRENCY, (candidate) => realFolder(candidate.path));
            const fresh = candidates.flatMap((candidate, index) => {
                const real = reals[index];
                return real === null || real === undefined || visited.has(real) ? [] : [{ ...candidate, real }];
            });
            const heads = await mapLimited(fresh, SCAN_CONCURRENCY, (candidate) => skillHead(candidate.path));
            for (const [index, candidate] of fresh.entries()) {
                // Two links in one folder can lead to the same place; the first one read it.
                if (visited.has(candidate.real)) {
                    continue;
                }
                const head = heads[index];
                if (head !== null && head !== undefined) {
                    visited.add(candidate.real);
                    const skill = skillOf(root, candidate.name, head);
                    if (skill !== null && skills.length < limits.skills) {
                        skills.push(skill);
                    }
                } else if (below < depth && !DEPENDENCY_FOLDERS.has(candidate.name)) {
                    visited.add(candidate.real);
                    next.push(candidate.path);
                }
            }
        }
        level = next;
    }
    return skills;
}

/* Every skill under these roots, sorted by name; the first root that carries a name wins. */
export async function scanSkillRoots(roots: SkillRoot[], limits: SkillScanLimits = SCAN_LIMITS): Promise<ChatSkill[]> {
    const found = new Map<string, ChatSkill>();
    for (const root of roots) {
        if (found.size >= limits.skills) {
            break;
        }
        for (const skill of await scanRoot(root, limits)) {
            if (!found.has(skill.name) && found.size < limits.skills) {
                found.set(skill.name, skill);
            }
        }
    }
    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function discoverSkills(kind: AgentKind, cwd: string, options: SkillRootOptions = {}): Promise<ChatSkill[]> {
    return scanSkillRoots(await skillRootsFor(kind, cwd, options));
}

const CACHE_TTL_MS = 30_000;

/* The skills of one CLI in one folder, scanned at most once per half minute. There is no watcher. */
export class SkillIndex {
    private readonly options: SkillRootOptions;
    private readonly cache = new Map<string, { at: number; skills: ChatSkill[] }>();

    constructor(options: SkillRootOptions = {}) {
        this.options = options;
    }

    async list(kind: AgentKind, cwd: string): Promise<ChatSkill[]> {
        const key = `${kind}:${cwd}`;
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
            return cached.skills;
        }
        const skills = await discoverSkills(kind, cwd, this.options);
        this.cache.set(key, { at: Date.now(), skills });
        return skills;
    }

    /* Drops the scan of one CLI in one folder, so the next look reads the disk again. */
    forget(kind: AgentKind, cwd: string): void {
        this.cache.delete(`${kind}:${cwd}`);
    }
}
