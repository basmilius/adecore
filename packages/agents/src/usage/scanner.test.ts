import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { mkdir, mkdtemp, open, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeIndex, type UsageIndex } from './index-file.ts';
import { UsageScanner, forEachLine } from './scanner.ts';
import type { UsageRootPath } from './roots.ts';

const made: string[] = [];

async function workspace(): Promise<{ home: string; claude: string; codex: string; roots: UsageRootPath[] }> {
    const base = await mkdtemp(join(tmpdir(), 'ruimte-usage-'));
    made.push(base);
    const claude = join(base, 'claude', 'projects');
    const codex = join(base, 'codex', 'sessions');
    await mkdir(claude, { recursive: true });
    await mkdir(codex, { recursive: true });

    return {
        home: join(base, 'home'),
        claude,
        codex,
        roots: [
            { provider: 'claude', path: claude },
            { provider: 'codex', path: codex }
        ]
    };
}

afterEach(async () => {
    await Promise.all(made.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function assistant(id: string, seconds: number, output: number): string {
    return `${JSON.stringify({
        type: 'assistant',
        timestamp: new Date(Date.parse('2026-09-10T09:00:00.000Z') + seconds * 1000).toISOString(),
        sessionId: 's-1',
        cwd: '/work/repo',
        message: {
            id,
            model: 'claude-opus-5',
            usage: { input_tokens: 10, cache_read_input_tokens: 100, cache_creation_input_tokens: 20, output_tokens: output }
        }
    })}\n`;
}

/* A session's `usage.json` as Grok writes it, the session totals left out since the reader goes by turn. */
function grokUsage(turns: ReadonlyArray<Record<string, unknown>>): string {
    return JSON.stringify({ sessionId: '01a1-session', updatedAt: '2026-10-21T10:00:00.000000+00:00', session: {}, turns });
}

function grokTurn(turnNumber: number, endedAt: string, modelUsage: Record<string, Record<string, number>>): Record<string, unknown> {
    return { turnNumber, endedAt, primaryModelId: Object.keys(modelUsage)[0], modelUsage };
}

describe('the usage scanner', () => {
    test('reads the log of a provider with no transcripts, and a call appended later once', async () => {
        const { home } = await workspace();
        const folder = join(home, '..', 'nanogpt', 'usage');
        await mkdir(folder, { recursive: true });

        const line = (seconds: number, completion: number): string =>
            `${JSON.stringify({
                at: Date.parse('2026-10-20T09:00:00.000Z') + seconds * 1000,
                model: 'z-ai/glm-5.3',
                session: 's-1',
                cwd: '/work/repo',
                input: 1000,
                cacheRead: 0,
                cacheWrite: 0,
                output: completion,
                reasoning: 0
            })}\n`;

        await writeFile(join(folder, '2026-10.jsonl'), line(0, 100));

        const scanner = new UsageScanner(home, [{ provider: 'nanogpt', path: folder }]);
        expect((await scanner.scan()).roots).toEqual([{ provider: 'nanogpt', path: folder, status: 'ok', message: null }]);
        expect(scanner.records().map((record) => [record.provider, record.totals.input, record.totals.output])).toEqual([['nanogpt', 1000, 100]]);

        await writeFile(join(folder, '2026-10.jsonl'), line(0, 100) + line(60, 250));
        await scanner.scan();
        expect(scanner.records().map((record) => record.totals.output)).toEqual([100, 250]);

        // A fresh scanner starts from the index it saved, and the provider survives the round trip.
        const warm = new UsageScanner(home, [{ provider: 'nanogpt', path: folder }]);
        expect((await warm.scan()).changedFiles).toBe(0);
        expect(warm.records().map((record) => record.provider)).toEqual(['nanogpt', 'nanogpt']);
    });

    test('reads Grok usage files whole, again when one is rewritten, and counts a turn it still lists once', async () => {
        const { home } = await workspace();
        const sessions = join(home, '..', 'grok', 'sessions');
        const folder = join(sessions, encodeURIComponent('/work/repo'), '01a1-session');
        await mkdir(folder, { recursive: true });
        await writeFile(join(folder, 'summary.json'), '{"info": {"id": "01a1-session"}}');
        const usage = join(folder, 'usage.json');

        const first = grokTurn(1, '2026-10-21T09:51:44.000000+00:00', {
            'grok-4.7-build-fast': { inputTokens: 1000, cachedReadTokens: 600, outputTokens: 50, modelCalls: 1, costUsdTicks: 10_000_000 }
        });

        await writeFile(usage, grokUsage([first]));

        const roots: UsageRootPath[] = [{ provider: 'grok', path: sessions }];
        const scanner = new UsageScanner(home, roots);
        expect(await scanner.scan()).toMatchObject({ files: 1, changedFiles: 1, roots: [{ provider: 'grok', status: 'ok' }] });
        expect(scanner.records().map((record) => [record.cwd, record.totals.input, record.costUsd])).toEqual([['/work/repo', 400, 0.001]]);

        const second = grokTurn(2, '2026-10-21T09:53:00.000000+00:00', {
            'grok-4.7-build-fast': { inputTokens: 2000, cachedReadTokens: 1500, outputTokens: 80, modelCalls: 2 }
        });

        await writeFile(usage, grokUsage([first, second]));
        await scanner.scan();
        expect(scanner.records().map((record) => record.totals.input)).toEqual([400, 500]);

        // A file caught halfway through a write keeps what was read of it, and is read again once whole.
        await writeFile(usage, '{"sessionId": "01a1-session", "turns": [');
        expect((await scanner.scan()).roots[0]!.status).toBe('ok');
        expect(scanner.records().map((record) => record.totals.input)).toEqual([400, 500]);

        const warm = new UsageScanner(home, roots);
        await warm.scan();

        expect(warm.records().map((record) => [record.provider, record.costUsd])).toEqual([
            ['grok', 0.001],
            ['grok', undefined]
        ]);
    });

    test('skips a Grok usage file that never read, and counts the others', async () => {
        const { home } = await workspace();
        const sessions = join(home, '..', 'grok', 'sessions');
        const broken = join(sessions, encodeURIComponent('/work/a'), 'broken');
        const fine = join(sessions, encodeURIComponent('/work/b'), 'fine');
        await mkdir(broken, { recursive: true });
        await mkdir(fine, { recursive: true });
        await writeFile(join(broken, 'usage.json'), 'not json');

        await writeFile(
            join(fine, 'usage.json'),
            grokUsage([grokTurn(1, '2026-10-21T09:51:44.000000+00:00', { 'grok-4.7-build': { inputTokens: 10, outputTokens: 5 } })])
        );

        const scanner = new UsageScanner(home, [{ provider: 'grok', path: sessions }]);
        expect(await scanner.scan()).toMatchObject({ files: 2, changedFiles: 1, roots: [{ status: 'ok' }] });
        expect(scanner.records().map((record) => record.cwd)).toEqual(['/work/b']);
    });

    test('reads both roots, keeps the index and opens nothing on a second pass', async () => {
        const { home, claude, codex, roots } = await workspace();
        await writeFile(join(claude, 'a.jsonl'), assistant('msg_1', 0, 40) + assistant('msg_2', 5, 60));
        await mkdir(join(codex, '2026'), { recursive: true });

        await writeFile(
            join(codex, '2026', 'b.jsonl'),
            [
                JSON.stringify({ type: 'session_meta', timestamp: '2026-09-10T09:00:00.000Z', payload: { id: 't-1', cwd: '/work/repo' } }),
                JSON.stringify({ type: 'turn_context', timestamp: '2026-09-10T09:00:01.000Z', payload: { model: 'gpt-5.6-sol' } }),
                JSON.stringify({
                    type: 'event_msg',
                    timestamp: '2026-09-10T09:00:02.000Z',
                    payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 500, cached_input_tokens: 400, output_tokens: 30 } } }
                }),
                ''
            ].join('\n')
        );

        const scanner = new UsageScanner(home, roots);
        const first = await scanner.scan();
        expect(first.files).toBe(2);
        expect(first.changedFiles).toBe(2);
        expect(first.roots.every((root) => root.status === 'ok')).toBe(true);
        expect(scanner.records()).toHaveLength(3);
        await expect(stat(join(home, 'usage', 'history.jsonl'))).resolves.toBeDefined();
        await expect(stat(join(home, 'usage', 'scan-state.json'))).resolves.toBeDefined();

        const second = await scanner.scan();
        expect(second.changedFiles).toBe(0);
        expect(scanner.records()).toHaveLength(3);

        // A fresh scanner starts from the index, without reading a transcript again.
        const warm = new UsageScanner(home, roots);
        const third = await warm.scan();
        expect(third.changedFiles).toBe(0);
        expect(warm.records()).toHaveLength(3);
    });

    test('parses added usage after verifying the committed bytes and counts a Codex turn once', async () => {
        const { home, codex, roots } = await workspace();
        const path = join(codex, 'grow.jsonl');

        const lines = [
            JSON.stringify({ type: 'session_meta', timestamp: '2026-09-10T09:00:00.000Z', payload: { id: 't-1', cwd: '/work/repo' } }),
            JSON.stringify({ type: 'turn_context', timestamp: '2026-09-10T09:00:01.000Z', payload: { model: 'gpt-5.6-sol' } }),
            JSON.stringify({
                type: 'event_msg',
                timestamp: '2026-09-10T09:00:02.000Z',
                payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 500, cached_input_tokens: 400, output_tokens: 30 } } }
            })
        ];

        await writeFile(path, `${lines.join('\n')}\n`);

        const scanner = new UsageScanner(home, roots);
        await scanner.scan();
        expect(scanner.records()).toHaveLength(1);

        const grown = JSON.stringify({
            type: 'event_msg',
            timestamp: '2026-09-10T09:01:00.000Z',
            payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 900, cached_input_tokens: 700, output_tokens: 50 } } }
        });

        await writeFile(path, `${[...lines, grown].join('\n')}\n`);
        const second = await scanner.scan();
        expect(second.changedFiles).toBe(1);
        const records = scanner.records();
        expect(records).toHaveLength(2);
        // The running total carried over, so the second turn is the difference and not the whole total.
        expect(records[1]!.totals).toEqual({ calls: 1, input: 100, cacheRead: 300, cacheWrite: 0, cacheWrite1h: 0, output: 20, reasoning: 0 });
    });

    test('reads a rewritten file from the start and keeps a file that has gone', async () => {
        const { home, claude, roots } = await workspace();
        const path = join(claude, 'a.jsonl');
        await writeFile(path, assistant('msg_1', 0, 40) + assistant('msg_2', 5, 60));
        const scanner = new UsageScanner(home, roots);
        await scanner.scan();
        expect(scanner.records()).toHaveLength(2);

        await writeFile(path, assistant('msg_3', 10, 15));
        await scanner.scan();
        expect(scanner.records()).toHaveLength(1);

        await rm(path);
        const gone = await scanner.scan();
        expect(gone.files).toBe(0);
        // Claude Code removes old transcripts; what they counted still happened.
        expect(scanner.records()).toHaveLength(1);
    });

    test('reads a file rewritten to a larger one from the start instead of as an append', async () => {
        const { home, claude, roots } = await workspace();
        const path = join(claude, 'a.jsonl');
        await writeFile(path, assistant('msg_1', 0, 40));
        const scanner = new UsageScanner(home, roots);
        await scanner.scan();

        await writeFile(path, assistant('msg_2', 5, 60) + assistant('msg_3', 10, 15));
        await scanner.scan();
        expect(scanner.records().map((record) => record.dedupeKey)).toEqual(['msg_2', 'msg_3']);

        // An index read back from disk knows the start of the file just as well.
        await writeFile(path, assistant('msg_4', 15, 25) + assistant('msg_5', 20, 35) + assistant('msg_6', 25, 45));
        const reloaded = new UsageScanner(home, roots);
        await reloaded.scan();
        expect(reloaded.records().map((record) => record.dedupeKey)).toEqual(['msg_4', 'msg_5', 'msg_6']);
    });

    test('says which root is not there instead of failing the pass', async () => {
        const { home } = await workspace();
        const scanner = new UsageScanner(home, [{ provider: 'claude', path: join(home, 'nowhere') }]);
        const report = await scanner.scan();
        expect(report.roots).toEqual([{ provider: 'claude', path: join(home, 'nowhere'), status: 'missing', message: null }]);
        expect(scanner.records()).toHaveLength(0);
    });

    test('detects a larger rewrite after an unchanged transcript header', async () => {
        const { home, claude, roots } = await workspace();
        const path = join(claude, 'a.jsonl');
        const header = `${JSON.stringify({ type: 'session_meta', padding: 'x'.repeat(8192) })}\n`;
        await writeFile(path, header + assistant('msg_1', 0, 40));
        await new UsageScanner(home, roots).scan();

        await writeFile(path, header + assistant('msg_2', 5, 60) + assistant('msg_3', 10, 15));
        const reloaded = new UsageScanner(home, roots);
        await reloaded.scan();
        expect(reloaded.records().map((record) => record.dedupeKey)).toEqual(['msg_2', 'msg_3']);
    });

    test('reads every byte of a cold or grown transcript at most once per scan', async () => {
        const { home, claude, roots } = await workspace();
        const path = join(claude, 'a.jsonl');
        const probe = await open(path, 'w');
        const read = spyOn(Object.getPrototypeOf(probe), 'read');
        await probe.close();

        const bytesRead = async (): Promise<number> => {
            const results = await Promise.all(read.mock.results.map((result) => result.value as Promise<{ bytesRead: number }>));
            read.mockClear();

            return results.reduce((sum, result) => sum + result.bytesRead, 0);
        };

        try {
            const header = `${JSON.stringify({ type: 'session_meta', padding: 'x'.repeat(200_000) })}\n`;
            let content = header + assistant('msg_1', 0, 40);
            await writeFile(path, content);
            const scanner = new UsageScanner(home, roots);
            await scanner.scan();
            expect(await bytesRead()).toBe(Buffer.byteLength(content));

            // The line still being written stays out of the hash, so the next append still verifies.
            content += assistant('msg_2', 5, 60).trimEnd();
            await writeFile(path, content);
            await scanner.scan();
            expect(await bytesRead()).toBe(Buffer.byteLength(content));

            content += `\n${assistant('msg_3', 10, 15)}`;
            await writeFile(path, content);
            const reloaded = new UsageScanner(home, roots);
            await reloaded.scan();
            expect(await bytesRead()).toBe(Buffer.byteLength(content));
            expect(reloaded.records().map((record) => record.dedupeKey)).toEqual(['msg_1', 'msg_2', 'msg_3']);
        } finally {
            read.mockRestore();
        }
    });

    test('reads a large transcript a chunk at a time, never whole', async () => {
        const { home, claude, roots } = await workspace();
        const path = join(claude, 'a.jsonl');
        const filler = `${JSON.stringify({ type: 'progress', padding: 'x'.repeat(100_000) })}\n`;
        const content = filler.repeat(40) + assistant('msg_1', 0, 40);
        await writeFile(path, content);
        const probe = await open(path, 'r');
        const read = spyOn(Object.getPrototypeOf(probe), 'read');
        await probe.close();

        try {
            const scanner = new UsageScanner(home, roots);
            await scanner.scan();
            const largest = Math.max(...read.mock.calls.map((call) => Number(call[2])));
            expect(largest).toBeLessThanOrEqual(1 << 20);
            expect(scanner.records().map((record) => record.dedupeKey)).toEqual(['msg_1']);
        } finally {
            read.mockRestore();
        }
    });

    test('a line still being written is counted once, not twice', async () => {
        const { home, claude, roots } = await workspace();
        const path = join(claude, 'a.jsonl');
        const partial = assistant('msg_1', 0, 40);
        await writeFile(path, partial + assistant('msg_2', 5, 60).trimEnd());
        const scanner = new UsageScanner(home, roots);
        await scanner.scan();
        expect(scanner.records()).toHaveLength(2);

        await writeFile(path, partial + assistant('msg_2', 5, 60) + assistant('msg_3', 9, 20));
        await scanner.scan();
        expect(scanner.records()).toHaveLength(3);
    });

    const codexSession = (threadId: string, input: number): string =>
        [
            JSON.stringify({ type: 'session_meta', timestamp: '2026-09-10T09:00:00.000Z', payload: { id: threadId, cwd: '/work/repo' } }),
            JSON.stringify({ type: 'turn_context', timestamp: '2026-09-10T09:00:01.000Z', payload: { model: 'gpt-5.6-sol' } }),
            JSON.stringify({
                type: 'event_msg',
                timestamp: '2026-09-10T09:00:02.000Z',
                payload: { type: 'token_count', info: { total_token_usage: { input_tokens: input, cached_input_tokens: 0, output_tokens: 30 } } }
            }),
            ''
        ].join('\n');

    test('gives a record the one account of its folder, and in a folder accounts share the account that ran its session', async () => {
        const { home, claude, codex } = await workspace();
        const work = join(home, 'claude_work', 'projects');
        await mkdir(work, { recursive: true });
        await writeFile(join(claude, 'a.jsonl'), assistant('msg_1', 0, 40));
        await writeFile(join(work, 'b.jsonl'), assistant('msg_2', 0, 40));
        await writeFile(join(codex, 'ran.jsonl'), codexSession('t-work', 500));
        await writeFile(join(codex, 'unknown.jsonl'), codexSession('t-elsewhere', 700));

        const roots: UsageRootPath[] = [
            { provider: 'claude', path: claude, accounts: ['claude'] },
            { provider: 'claude', path: work, accounts: ['claude_work'] },
            { provider: 'codex', path: codex, accounts: ['codex', 'codex_work'] }
        ];

        const scanner = new UsageScanner(home, roots, { sessionAccounts: () => new Map([['codex\0t-work', 'codex_work']]) });
        await scanner.scan();

        const accountOf = (sessionOrMessage: string): string | undefined =>
            scanner.records().find((record) => record.sessionId === sessionOrMessage || record.dedupeKey?.includes(sessionOrMessage))?.account;

        expect(accountOf('msg_1')).toBeUndefined();
        expect(accountOf('msg_2')).toBe('claude_work');
        expect(accountOf('t-work')).toBe('codex_work');
        expect(accountOf('t-elsewhere')).toBeUndefined();

        // Kept in the index, so a fresh scanner knows it without asking again.
        const warm = new UsageScanner(home, roots);
        await warm.scan();

        expect(
            warm
                .records()
                .map((record) => record.account ?? null)
                .sort()
        ).toEqual(['claude_work', 'codex_work', null, null]);
    });

    test('reads an index from before accounts as the default account, without reading a transcript again', async () => {
        const { home, claude, roots } = await workspace();
        const path = join(claude, 'a.jsonl');
        await writeFile(path, assistant('msg_1', 0, 40) + assistant('msg_2', 5, 60));
        const elsewhere = new UsageScanner(join(home, '..', 'elsewhere'), roots);
        await elsewhere.scan();
        const info = await stat(path);

        const legacy: UsageIndex = new Map([
            [
                path,
                {
                    provider: 'claude',
                    size: info.size,
                    mtimeMs: info.mtimeMs,
                    offset: info.size,
                    records: elsewhere.records(),
                    tail: [],
                    codex: null,
                    head: null
                }
            ]
        ]);

        const file = join(home, 'usage', 'index.json');
        await mkdir(join(home, 'usage'), { recursive: true });
        const index = JSON.parse(encodeIndex(legacy)) as { version: number; accounts?: string[]; files: Record<string, { r: unknown[][] }> };
        index.version = 1;
        delete index.accounts;

        for (const entry of Object.values(index.files)) {
            entry.r = entry.r.map((row) => row.slice(0, 12));
        }

        await writeFile(file, JSON.stringify(index));

        const scanner = new UsageScanner(home, roots);
        const report = await scanner.scan();
        expect(report.changedFiles).toBe(0);
        expect(scanner.records()).toHaveLength(2);
        expect(scanner.records().every((record) => record.account === undefined)).toBe(true);
    });
});

describe('forEachLine', () => {
    async function* pieces(bytes: Buffer, size: number): AsyncGenerator<Uint8Array> {
        for (let at = 0; at < bytes.length; at += size) {
            yield bytes.subarray(at, at + size);
        }
    }

    test('gives the same lines, hash and rest whatever the chunks cut through', async () => {
        const bytes = Buffer.from('first line\r\nzweite Zeile mit Umlaut ä und 😀\n\nthird\nstill being writ');
        const committed = bytes.subarray(0, bytes.lastIndexOf('\n') + 1);

        for (const size of [1, 2, 3, 7, 64, bytes.length]) {
            const lines: string[] = [];
            const hash = createHash('sha256');
            const read = await forEachLine(pieces(bytes, size), hash, (line) => lines.push(line));
            expect(lines).toEqual(['first line\r', 'zweite Zeile mit Umlaut ä und 😀', '', 'third']);
            expect(read).toEqual({ consumed: committed.length, rest: 'still being writ' });
            expect(hash.digest('hex')).toBe(createHash('sha256').update(committed).digest('hex'));
        }
    });
});
