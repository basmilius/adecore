import { afterEach, describe, expect, test } from 'bun:test';
import { appendFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aggregate } from './aggregate.ts';
import { decodeIndex, encodeIndex, type UsageIndex } from './index-file.ts';
import { PriceBook } from './pricing.ts';
import { foldByKey, type UsageRecord } from './record.ts';
import type { UsageRootPath } from './roots.ts';
import { UsageScanner } from './scanner.ts';
import { UsageService } from './usage-service.ts';

const made: string[] = [];

afterEach(async () => {
    await Promise.all(made.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function workspace(): Promise<{ home: string; usage: string; claude: string; roots: UsageRootPath[] }> {
    const base = await mkdtemp(join(tmpdir(), 'adecore-usage-store-'));
    made.push(base);
    const claude = join(base, 'claude', 'projects');
    await mkdir(claude, { recursive: true });
    const home = join(base, 'home');

    return { home, usage: join(home, 'usage'), claude, roots: [{ provider: 'claude', path: claude }] };
}

function assistant(id: string, seconds: number, output: number, model = 'claude-opus-5'): string {
    return `${JSON.stringify({
        type: 'assistant',
        timestamp: new Date(Date.parse('2026-09-10T09:00:00.000Z') + seconds * 1000).toISOString(),
        sessionId: 's-1',
        cwd: '/work/repo',
        message: { id, model, usage: { input_tokens: 10, cache_read_input_tokens: 100, cache_creation_input_tokens: 20, output_tokens: output } }
    })}\n`;
}

function record(id: string, output: number, patch: Partial<UsageRecord> = {}): UsageRecord {
    return {
        provider: 'claude',
        timestampMs: Date.parse('2026-09-10T08:00:00.000Z'),
        model: 'claude-sonnet-5',
        sessionId: 's-gone',
        cwd: '/work/gone',
        totals: { calls: 1, input: 10, cacheRead: 100, cacheWrite: 20, cacheWrite1h: 0, output, reasoning: 0 },
        dedupeKey: id,
        ...patch
    };
}

const exists = (path: string): Promise<boolean> =>
    stat(path).then(
        () => true,
        () => false
    );

/* An index of the single-file format: one transcript that is still there and one whose source is gone. */
async function legacyIndex(home: string, claude: string, roots: UsageRootPath[]): Promise<UsageIndex> {
    const path = join(claude, 'a.jsonl');
    await writeFile(path, assistant('msg_1', 0, 40) + assistant('msg_2', 5, 60));
    const elsewhere = new UsageScanner(join(home, '..', 'elsewhere'), roots);
    await elsewhere.scan();
    const info = await stat(path);

    const index: UsageIndex = new Map([
        [
            path,
            { provider: 'claude', size: info.size, mtimeMs: info.mtimeMs, offset: info.size, records: elsewhere.records(), tail: [], codex: null, head: null }
        ],
        [
            join(claude, 'gone.jsonl'),
            {
                provider: 'claude',
                size: 900,
                mtimeMs: 1,
                offset: 800,
                records: [record('msg_old', 70), record('msg_work', 30, { account: 'claude_work', costUsd: 0.25 })],
                tail: [record('msg_tail', 5)],
                codex: null,
                head: null
            }
        ]
    ]);

    await mkdir(join(home, 'usage'), { recursive: true });
    await writeFile(join(home, 'usage', 'index.json'), encodeIndex(index));

    return index;
}

describe('the usage store', () => {
    test('migrates an index once into history and scan state, with the same totals', async () => {
        const { home, usage, claude, roots } = await workspace();
        const index = await legacyIndex(home, claude, roots);
        const before = foldByKey(
            [...(decodeIndex(await readFile(join(usage, 'index.json'), 'utf8'))?.values() ?? [])].flatMap((file) => [...file.records, ...file.tail])
        );
        expect(before).toHaveLength(5);

        const payload = { from: '2026-09-10', to: '2026-09-10', resolution: 'day', timeZone: 'UTC' } as const;
        const expected = await aggregate(before, payload, new PriceBook(home, false), []);
        const service = new UsageService({ home, roots, allowPriceFetch: false, knownProjects: async () => [] });
        const summary = await service.summary(payload);
        service.stop();

        expect(summary.scan.changedFiles).toBe(0);
        expect({ buckets: summary.buckets, models: summary.models, projects: summary.projects, sessions: summary.sessions }).toEqual(expected);
        expect(await exists(join(usage, 'index.json'))).toBe(false);
        expect(await exists(join(usage, 'history.jsonl'))).toBe(true);

        // The transcript that is gone keeps its usage; only where a scan left it is dropped.
        const state = JSON.parse(await readFile(join(usage, 'scan-state.json'), 'utf8')) as { files: Record<string, unknown> };
        expect(Object.keys(state.files)).toEqual([join(claude, 'a.jsonl')]);
        const reloaded = new UsageScanner(home, roots);
        await reloaded.scan();
        expect(reloaded.records()).toEqual(before);
        expect(index.size).toBe(2);
    });

    test('finishes a migration that stopped after writing the history, without counting it twice', async () => {
        const { home, usage, claude, roots } = await workspace();
        await legacyIndex(home, claude, roots);
        const legacy = await readFile(join(usage, 'index.json'));
        const first = new UsageScanner(home, roots);
        await first.scan();
        await writeFile(join(usage, 'index.json'), legacy);
        await rm(join(usage, 'scan-state.json'));

        const scanner = new UsageScanner(home, roots);
        await scanner.scan();
        expect(scanner.records()).toEqual(first.records());
        expect(await exists(join(usage, 'index.json'))).toBe(false);
    });

    test('keeps an index that does not read beside a fresh history', async () => {
        const { home, usage, claude, roots } = await workspace();
        await mkdir(usage, { recursive: true });
        await writeFile(join(usage, 'index.json'), 'not an index');
        await writeFile(join(claude, 'a.jsonl'), assistant('msg_1', 0, 40));
        const scanner = new UsageScanner(home, roots);
        await scanner.scan();
        expect(scanner.records()).toHaveLength(1);
        expect(await readFile(join(usage, 'index.json.unreadable'), 'utf8')).toBe('not an index');
    });

    test('appends what a grown transcript added and leaves the history before it as it was', async () => {
        const { home, usage, claude, roots } = await workspace();
        const path = join(claude, 'a.jsonl');
        await writeFile(path, assistant('msg_1', 0, 40) + assistant('msg_2', 5, 60));
        await writeFile(join(claude, 'b.jsonl'), assistant('msg_9', 0, 90));
        const scanner = new UsageScanner(home, roots);
        await scanner.scan();
        const history = await readFile(join(usage, 'history.jsonl'));

        await appendFile(path, assistant('msg_3', 10, 15));
        await scanner.scan();
        const grown = await readFile(join(usage, 'history.jsonl'));
        expect(grown.subarray(0, history.length).equals(history)).toBe(true);
        const added = grown.subarray(history.length).toString('utf8');
        expect(added.trimEnd().split('\n')).toHaveLength(1);
        expect(JSON.parse(added)).toMatchObject({ p: path, op: 'add', r: [[expect.any(Number), 0, 0, 0, 1, 10, 100, 20, 0, 15, 0, 'msg_3', 0]] });

        // Nothing new is no line at all.
        await scanner.scan();
        expect((await readFile(join(usage, 'history.jsonl'))).length).toBe(grown.length);

        const reloaded = new UsageScanner(home, roots);
        const report = await reloaded.scan();
        expect(report.changedFiles).toBe(0);
        expect(reloaded.records()).toEqual(scanner.records());
    });

    test('a state saved before the lines it would account for is dropped, so nothing is counted twice', async () => {
        const { home, usage, claude, roots } = await workspace();
        const path = join(claude, 'a.jsonl');
        await writeFile(path, assistant('msg_1', 0, 40));
        const scanner = new UsageScanner(home, roots);
        await scanner.scan();
        const stale = await readFile(join(usage, 'scan-state.json'));

        await appendFile(path, assistant('msg_2', 5, 60));
        await scanner.scan();
        // A crash after the append and before the state landed.
        await writeFile(join(usage, 'scan-state.json'), stale);

        const reloaded = new UsageScanner(home, roots);
        await reloaded.scan();
        expect(reloaded.records().map((entry) => entry.dedupeKey)).toEqual(['msg_1', 'msg_2']);
    });

    test('cuts a half-written last line and keeps every line before it', async () => {
        const { home, usage, claude, roots } = await workspace();
        const path = join(claude, 'a.jsonl');
        await writeFile(path, assistant('msg_1', 0, 40));
        const scanner = new UsageScanner(home, roots);
        await scanner.scan();
        const history = await readFile(join(usage, 'history.jsonl'));
        await appendFile(join(usage, 'history.jsonl'), '{"p":"/half');

        const reloaded = new UsageScanner(home, roots);
        const report = await reloaded.scan();
        expect(report.changedFiles).toBe(0);
        expect(reloaded.records()).toEqual(scanner.records());
        expect((await readFile(join(usage, 'history.jsonl'))).equals(history)).toBe(true);
    });

    test('a reset of the scan state reads the transcripts again and keeps the usage of those that are gone', async () => {
        const { home, usage, claude, roots } = await workspace();
        await writeFile(join(claude, 'a.jsonl'), assistant('msg_1', 0, 40));
        await writeFile(join(claude, 'b.jsonl'), assistant('msg_2', 5, 60));
        const scanner = new UsageScanner(home, roots);
        await scanner.scan();
        await rm(join(claude, 'b.jsonl'));
        await scanner.scan();
        const history = await readFile(join(usage, 'history.jsonl'));
        await rm(join(usage, 'scan-state.json'));

        const reloaded = new UsageScanner(home, roots);
        const report = await reloaded.scan();
        expect(report.changedFiles).toBe(1);
        expect(reloaded.records().map((entry) => entry.dedupeKey)).toEqual(scanner.records().map((entry) => entry.dedupeKey));
        expect(reloaded.records()).toHaveLength(2);
        // Read again unchanged, a transcript writes no line.
        expect((await readFile(join(usage, 'history.jsonl'))).equals(history)).toBe(true);
    });

    test('rewrites the history once superseded lines outweigh it, with the same records', async () => {
        const { home, usage, claude, roots } = await workspace();
        const path = join(claude, 'a.jsonl');
        const padding = 'x'.repeat(4000);
        const scanner = new UsageScanner(home, roots);
        let previous = 0;
        let shrank = false;

        for (let i = 0; i < 400 && !shrank; i++) {
            // A file rewritten each time replaces its line; the old ones are dead weight.
            await writeFile(path, assistant(`msg_${i}`, i, 40, `model-${padding}${'y'.repeat(i)}`));
            await scanner.scan();
            const size = (await stat(join(usage, 'history.jsonl'))).size;
            shrank = size < previous;
            previous = size;
        }

        expect(shrank).toBe(true);
        const reloaded = new UsageScanner(home, roots);
        await reloaded.scan();
        expect(reloaded.records()).toEqual(scanner.records());
        expect(scanner.records()).toHaveLength(1);
    });
});
