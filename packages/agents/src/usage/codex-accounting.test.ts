import { afterEach, describe, expect, test } from 'bun:test';
import { UsageService } from './index.ts';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zstdCompressSync } from 'node:zlib';

const folders: string[] = [];
const date = '2026-10-21';

afterEach(async () => {
    await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })));
});

function line(type: string, payload: Record<string, unknown>, seconds = 0): string {
    return JSON.stringify({ type, timestamp: `${date}T10:00:${seconds.toString().padStart(2, '0')}.000Z`, payload });
}

function counts(input = 1000, cached = 800, output = 50) {
    return { input_tokens: input, cached_input_tokens: cached, output_tokens: output, reasoning_output_tokens: 10, total_tokens: input + output };
}

function tokens(usage = counts(), seconds = 2): string {
    return line('event_msg', { type: 'token_count', info: { total_token_usage: usage, last_token_usage: usage } }, seconds);
}

function settings(tier: string | null): string {
    return line('event_msg', { type: 'thread_settings_applied', thread_settings: tier === null ? {} : { service_tier: tier } });
}

function header(model = 'gpt-6.1-sol', id = 'session-1'): string[] {
    return [line('session_meta', { id, cwd: '/work/repo' }), line('turn_context', { model })];
}

function request(id = 'response-1', usage = counts(200, 100, 20), threadUsage?: ReturnType<typeof counts>): string {
    return line('token_usage_record', { response_id: id, usage, ...(threadUsage === undefined ? {} : { thread_token_usage: threadUsage }) }, 3);
}

function compacted(id = 'response-1'): string {
    return line('compacted', { compaction_response_id: id }, 4);
}

async function workspace() {
    const home = await mkdtemp(join(tmpdir(), 'ruimte-codex-usage-'));
    folders.push(home);
    const codex = join(home, 'sessions');
    await mkdir(codex);
    await mkdir(join(home, 'usage'));

    const price = {
        litellm_provider: 'openai',
        mode: 'responses',
        input_cost_per_token: 0.000002,
        cache_read_input_token_cost: 0.0000001,
        output_cost_per_token: 0.00001,
        input_cost_per_token_priority: 0.000006,
        cache_read_input_token_cost_priority: 0.0000003,
        output_cost_per_token_priority: 0.00003
    };

    await writeFile(join(home, 'usage', 'prices.json'), JSON.stringify({ fetchedAt: Date.now(), document: { 'gpt-6.1-sol': price, 'gpt-5.6-luna': price } }));

    const createService = () => new UsageService({ home, roots: [{ provider: 'codex', path: codex }], allowPriceFetch: false, knownProjects: async () => [] });

    const summary = (service = createService()) => service.summary({ from: date, to: date, resolution: 'day', timeZone: 'Europe/Amsterdam' });

    const write = async (lines: string[], name = 'session.jsonl') => {
        await writeFile(join(codex, name), `${lines.join('\n')}\n`);
    };

    return { home, codex, summary, createService, write };
}

describe('Codex usage accounting', () => {
    test('counts remote compaction once alongside regular calls', async () => {
        const { summary, write } = await workspace();
        await write([...header(), tokens(), request(), compacted(), request(), compacted()]);
        const result = await summary();
        expect(result.models[0]!.totals).toMatchObject({ calls: 2, input: 300, cacheRead: 900, output: 70 });
        expect(result.models[0]!.costUsd).toBeCloseTo(0.00139, 10);
    });

    test.each([false, true])('pairs a compaction marker before its usage: %s', async (markerFirst) => {
        const { summary, write } = await workspace();
        await write([...header(), ...(markerFirst ? [compacted(), request()] : [request(), compacted()])]);
        expect((await summary()).models[0]!.totals).toMatchObject({ calls: 1, input: 100, cacheRead: 100, output: 20 });
    });

    test('does not charge a local compaction twice when cumulative usage includes it', async () => {
        const { summary, write } = await workspace();
        const total = counts(1200, 900, 70);
        await write([...header(), tokens(), request('response-1', counts(200, 100, 20), total), tokens(total, 4), compacted()]);
        expect((await summary()).models[0]!.totals).toMatchObject({ calls: 2, input: 300, cacheRead: 900, output: 70 });
    });

    test('does not count an unmatched request usage record', async () => {
        const { summary, write } = await workspace();
        await write([...header(), tokens(), request()]);
        expect((await summary()).models[0]!.totals.calls).toBe(1);
    });

    test('keeps pending compactions across an incremental scan and index reload', async () => {
        const { summary, write } = await workspace();
        const lines = [...header(), tokens(), request()];
        await write(lines);
        expect((await summary()).models[0]!.totals.calls).toBe(1);
        await write([...lines, compacted()]);
        expect((await summary()).models[0]!.totals.calls).toBe(2);
        expect((await summary()).models[0]!.totals.calls).toBe(2);
    });

    test('deduplicates compaction responses copied into a fork', async () => {
        const { summary, write } = await workspace();
        await write([...header(), request(), compacted()]);

        await write(
            [line('session_meta', { id: 'child', forked_from_id: 'session-1', cwd: '/work/repo' }), header()[1]!, request(), compacted()],
            'fork.jsonl'
        );

        expect((await summary()).models[0]!.totals.calls).toBe(1);
    });

    test('prices priority calls with the recorded tier and preserves it in the index', async () => {
        const { summary, write } = await workspace();
        await write([...header(), settings('priority'), settings(null), tokens()]);
        expect((await summary()).models[0]!.costUsd).toBeCloseTo(0.00294, 10);
        expect((await summary()).models[0]!.costUsd).toBeCloseTo(0.00294, 10);
    });

    test.each(['default', 'standard', 'unexpected'])('clears priority when the recorded tier becomes %s', async (tier) => {
        const { summary, write } = await workspace();
        await write([...header(), settings('priority'), settings(tier), tokens()]);
        expect((await summary()).models[0]!.costUsd).toBeCloseTo(0.00098, 10);
    });

    test('labels automatic review pricing as an estimate using its fallback model', async () => {
        const { summary, write } = await workspace();
        await write([...header('codex-auto-review'), tokens()]);
        expect((await summary()).models[0]).toMatchObject({ model: 'codex-auto-review', priceBasis: 'family', pricedAs: 'gpt-5.6-luna' });
        expect((await summary()).models[0]!.costUsd).toBeCloseTo(0.00098, 10);
    });

    test('counts compressed logs and preserves one session when their encoding changes', async () => {
        const { codex, summary, write } = await workspace();
        const lines = [...header(), tokens()];
        await write(lines);
        const plain = join(codex, 'session.jsonl');
        const compressed = `${plain}.zst`;
        const bytes = await readFile(plain);
        expect((await summary()).models[0]!.totals.calls).toBe(1);
        await writeFile(compressed, zstdCompressSync(bytes));
        await rm(plain);
        expect((await summary()).models[0]!.totals.calls).toBe(1);
        await write(lines);
        expect((await summary()).models[0]!.totals.calls).toBe(1);
        await rm(compressed);
        expect((await summary()).models[0]!.totals.calls).toBe(1);
    });

    test('reads compressed transcripts on a cold scan', async () => {
        const { codex, summary } = await workspace();
        await writeFile(join(codex, 'session.jsonl.zst'), zstdCompressSync(Buffer.from(`${[...header(), tokens(), request(), compacted()].join('\n')}\n`)));
        expect((await summary()).models[0]!.totals.calls).toBe(2);
    });

    test('reparses unchanged Codex logs from an index written before the accounting fix', async () => {
        const { home, summary, write } = await workspace();
        await write([...header(), settings('priority'), tokens(), request(), compacted()]);
        await summary();
        const path = join(home, 'usage', 'index.json');
        const index = JSON.parse(await readFile(path, 'utf8'));
        index.version = 2;

        for (const file of Object.values(index.files) as Array<{ v?: number; r: unknown[][]; c: unknown }>) {
            delete file.v;
            file.r = [];
            file.c = null;
        }

        await writeFile(path, JSON.stringify(index));
        const result = await summary();
        expect(result.models[0]!.totals.calls).toBe(2);
        expect(result.models[0]!.costUsd).toBeCloseTo(0.00417, 10);
    });

    test('retains prior usage when a compressed transcript becomes unreadable', async () => {
        const { codex, summary } = await workspace();
        const path = join(codex, 'session.jsonl.zst');
        await writeFile(path, zstdCompressSync(Buffer.from(`${[...header(), tokens()].join('\n')}\n`)));
        await summary();
        await rename(path, `${path}.old`);
        await writeFile(path, 'broken zstd');
        const result = await summary();
        expect(result.models[0]!.totals.calls).toBe(1);
        expect(result.roots[0]!.status).toBe('failed');
    });
});
