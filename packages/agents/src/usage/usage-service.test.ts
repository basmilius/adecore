import { afterEach, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentEvent } from '../events.ts';
import { claudeTranscriptRoot } from './roots.ts';
import { UsageService } from './usage-service.ts';

const made: string[] = [];
const originalFetch = globalThis.fetch;

afterEach(async () => {
    globalThis.fetch = originalFetch;
    await Promise.all(made.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

test('Claude Code transcripts in a folder of their own count under the provider that wrote them, with tokens and cost', async () => {
    const home = await mkdtemp(join(tmpdir(), 'ruimte-usage-service-'));
    made.push(home);
    const configDir = join(home, 'claude-api');
    await mkdir(join(configDir, 'projects', '-work-repo'), { recursive: true });

    const line = {
        type: 'assistant',
        timestamp: '2026-10-13T09:00:00.000Z',
        sessionId: 's-api',
        cwd: '/work/repo',
        message: {
            id: 'msg_api',
            model: 'claude-opus-5',
            usage: { input_tokens: 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 500 }
        }
    };

    await writeFile(join(configDir, 'projects', '-work-repo', 's-api.jsonl'), `${JSON.stringify(line)}\n`);
    const service = new UsageService({
        home,
        allowPriceFetch: false,
        roots: [claudeTranscriptRoot('anthropic-claude-api', configDir)],
        knownProjects: async () => []
    });

    const summary = await service.summary({ from: '2026-10-13', to: '2026-10-13', resolution: 'day', timeZone: 'UTC' });

    expect(summary.roots).toMatchObject([{ provider: 'anthropic-claude-api', status: 'ok' }]);
    expect(summary.models).toHaveLength(1);
    expect(summary.models[0]).toMatchObject({ provider: 'anthropic-claude-api', model: 'claude-opus-5', totals: { input: 1000, output: 500 } });
    expect(summary.models[0]!.costUsd).toBeGreaterThan(0);
    service.stop();
});

test('a summary does not wait for the price table or the rate, and their arrival is announced', async () => {
    const home = await mkdtemp(join(tmpdir(), 'ruimte-usage-service-'));
    made.push(home);
    const answers: Array<() => void> = [];

    globalThis.fetch = ((url: string) =>
        new Promise<Response>((resolve) => {
            const body = String(url).includes('frankfurter') ? { date: '2026-10-13', rates: { EUR: 0.9 } } : {};
            answers.push(() => resolve(Response.json(body)));
        })) as typeof fetch;

    const service = new UsageService({ home, roots: [], knownProjects: async () => [] });
    const events: AgentEvent[] = [];
    const changed = Promise.withResolvers<void>();

    service.subscribe('client', (event) => {
        events.push(event);

        if (event.event === 'usage.changed') {
            changed.resolve();
        }
    });

    const summary = await service.summary({ from: '2026-10-13', to: '2026-10-13', resolution: 'day', timeZone: 'UTC' });
    expect(summary.rate).toBeNull();
    expect(answers).toHaveLength(2);

    for (const answer of answers) {
        answer();
    }

    await changed.promise;
    expect(events.map((event) => event.event)).toEqual(['usage.changed']);
    const again = await service.summary({ from: '2026-10-13', to: '2026-10-13', resolution: 'day', timeZone: 'UTC' });
    expect(again.rate?.rate).toBe(0.9);
    service.stop();
});
