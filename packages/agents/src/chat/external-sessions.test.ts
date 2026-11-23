import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zstdCompressSync } from 'node:zlib';
import { claudeProjectSlug } from './claude-transcript.ts';
import { listClaudeSessions, listCodexSessions, nodeSessionFs, type SessionFs } from './external-sessions.ts';

/* An in-memory tree: a path with content is a file, every parent of one is a folder. Paths are kept with forward slashes, whatever the platform joins with. */
function memoryFs(files: Record<string, { content: string; mtimeMs?: number }>) {
    const touched: string[] = [];

    const posix = (path: string): string => path.replaceAll('\\', '/');

    const fs: SessionFs = {
        readdir: async (native) => {
            const path = posix(native);
            touched.push(path);
            const prefix = `${path}/`;

            return [
                ...new Set(
                    Object.keys(files)
                        .filter((file) => file.startsWith(prefix))
                        .map((file) => file.slice(prefix.length).split('/')[0]!)
                )
            ];
        },
        stat: async (native) => {
            const path = posix(native);
            touched.push(path);
            const file = files[path];

            return file === undefined ? null : { mtimeMs: file.mtimeMs ?? 1 };
        },
        readHead: async (native) => {
            const path = posix(native);
            touched.push(path);

            return files[path]?.content ?? '';
        }
    };

    return { fs, touched };
}

const lines = (...entries: unknown[]): string => entries.map((entry) => JSON.stringify(entry)).join('\n');

const userLine = (text: string, extra: Record<string, unknown> = {}) => ({ type: 'user', message: { role: 'user', content: text }, ...extra });

describe('Claude sessions', () => {
    const folder = '/work/app';
    const projects = '/home/.claude/projects';
    const dir = `${projects}/${claudeProjectSlug(folder)}`;

    test('lists the sessions of the folder with the first thing said, newest first', async () => {
        const { fs } = memoryFs({
            [`${dir}/old.jsonl`]: { content: lines(userLine('First\nprompt')), mtimeMs: 1 },
            [`${dir}/new.jsonl`]: { content: lines({ type: 'queue-operation' }, userLine('Newer prompt')), mtimeMs: 2 }
        });

        const sessions = await listClaudeSessions({ projectsDir: projects, folder, fs });

        expect(sessions.map((session) => [session.sessionId, session.title, session.updatedAt])).toEqual([
            ['new', 'Newer prompt', 2],
            ['old', 'First prompt', 1]
        ]);
    });

    test('leaves out files nobody spoke in, and the lines that are not somebody speaking', async () => {
        const { fs } = memoryFs({
            [`${dir}/sidechain.jsonl`]: { content: lines(userLine('from an agent', { isSidechain: true })) },
            [`${dir}/summary.jsonl`]: { content: lines({ type: 'summary', summary: 'x' }, { type: 'file-history-snapshot' }) },
            [`${dir}/meta.jsonl`]: { content: lines(userLine('reminder', { isMeta: true })) },
            [`${dir}/tool.jsonl`]: { content: lines({ type: 'user', message: { content: [{ type: 'tool_result', content: 'x' }] } }) },
            [`${dir}/real.jsonl`]: { content: lines(userLine('reminder', { isMeta: true }), userLine('the real one')) },
            [`${dir}/session-1/subagents/agent-a.jsonl`]: { content: lines(userLine('subagent prompt')) }
        });

        const sessions = await listClaudeSessions({ projectsDir: projects, folder, fs });
        expect(sessions.map((session) => [session.sessionId, session.title])).toEqual([['real', 'the real one']]);
    });
});

describe('Codex sessions', () => {
    const folder = '/work/app';
    const root = '/home/.codex/sessions';

    const meta = (id: string, cwd: string, extra: Record<string, unknown> = {}) => ({ type: 'session_meta', payload: { id, cwd, ...extra } });

    const said = (message: string) => ({ type: 'event_msg', payload: { type: 'user_message', message } });

    test('keeps the rollouts of the folder and drops forks, subagents and other folders', async () => {
        const { fs } = memoryFs({
            [`${root}/2026/10/10/rollout-2026-10-10T08-00-00-a.jsonl`]: { content: lines(meta('a', folder), said('Fix the lexer')), mtimeMs: 10 },
            [`${root}/2026/10/11/rollout-2026-10-11T08-00-00-b.jsonl`]: { content: lines(meta('b', folder), said('Newer')), mtimeMs: 20 },
            [`${root}/2026/10/11/rollout-2026-10-11T09-00-00-fork.jsonl`]: { content: lines(meta('fork', folder, { forked_from_id: 'a' }), said('x')) },
            [`${root}/2026/10/11/rollout-2026-10-11T10-00-00-sub.jsonl`]: {
                content: lines(meta('sub', folder, { source: { subagent: { thread_spawn: { parent_thread_id: 'b' } } } }), said('x'))
            },
            [`${root}/2026/10/11/rollout-2026-10-11T11-00-00-other.jsonl`]: { content: lines(meta('other', '/elsewhere'), said('x')) },
            [`${root}/2026/10/11/rollout-2026-10-11T12-00-00-silent.jsonl`]: { content: lines(meta('silent', folder)) }
        });

        const sessions = await listCodexSessions({ sessionsDir: root, folder, fs });

        expect(sessions.map((session) => [session.sessionId, session.title, session.updatedAt])).toEqual([
            ['b', 'Newer', 20],
            ['a', 'Fix the lexer', 10]
        ]);
    });

    test('lists a rollout Codex compressed, and its plain copy once when both are there', async () => {
        const { fs } = memoryFs({
            [`${root}/2026/10/10/rollout-2026-10-10T08-00-00-a.jsonl.zst`]: { content: lines(meta('a', folder), said('Compressed')), mtimeMs: 10 },
            [`${root}/2026/10/11/rollout-2026-10-11T08-00-00-b.jsonl`]: { content: lines(meta('b', folder), said('Plain')), mtimeMs: 20 },
            [`${root}/2026/10/11/rollout-2026-10-11T08-00-00-b.jsonl.zst`]: { content: lines(meta('b', folder), said('Plain')), mtimeMs: 20 }
        });

        const sessions = await listCodexSessions({ sessionsDir: root, folder, fs });

        expect(sessions.map((session) => [session.sessionId, session.title])).toEqual([
            ['b', 'Plain'],
            ['a', 'Compressed']
        ]);
    });

    test('looks only at the newest rollouts', async () => {
        const { fs } = memoryFs({
            [`${root}/2026/10/09/rollout-1.jsonl`]: { content: lines(meta('old', folder), said('old')) },
            [`${root}/2026/10/10/rollout-2.jsonl`]: { content: lines(meta('new', folder), said('new')) }
        });

        const sessions = await listCodexSessions({ sessionsDir: root, folder, fs, maxFiles: 1 });
        expect(sessions.map((session) => session.sessionId)).toEqual(['new']);
    });
});

test('the file system on node reads the head of a compressed rollout decompressed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'adecore-sessions-'));

    try {
        const text = lines({ type: 'session_meta', payload: { id: 'a' } }, { padding: 'x'.repeat(4_000) });
        const path = join(dir, 'rollout-a.jsonl.zst');
        await writeFile(path, zstdCompressSync(Buffer.from(text)));

        const fs = await nodeSessionFs();

        expect(await fs.readHead(path, 1_000)).toBe(text.slice(0, 1_000));
        expect(await fs.readHead(path, 100_000)).toBe(text);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test('nothing outside the given roots is read', async () => {
    const claude = '/home/.claude/projects';
    const codex = '/home/.codex/sessions';
    const folder = '/work/app';

    const { fs, touched } = memoryFs({
        [`${claude}/${claudeProjectSlug(folder)}/s.jsonl`]: { content: lines(userLine('hi')) },
        [`${claude}/${claudeProjectSlug('/other')}/s.jsonl`]: { content: lines(userLine('hi')) },
        [`${codex}/2026/10/10/rollout-1.jsonl`]: { content: lines({ type: 'session_meta', payload: { id: 'a', cwd: folder } }) },
        '/home/.codex/auth.json': { content: '{}' },
        '/home/.claude/.credentials.json': { content: '{}' }
    });

    await listClaudeSessions({ projectsDir: claude, folder, fs });
    await listCodexSessions({ sessionsDir: codex, folder, fs });
    expect(touched.length).toBeGreaterThan(0);
    expect(
        touched.every((path) => path === claude || path === codex || path.startsWith(`${claude}/${claudeProjectSlug(folder)}`) || path.startsWith(`${codex}/`))
    ).toBe(true);
});
