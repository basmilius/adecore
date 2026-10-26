import { describe, expect, test } from 'bun:test';
import { parseGrokUsage } from './grok.ts';

const PATH = '/home/.grok/sessions/%2FUsers%2Fbas%2Fwork%20repo/01a1-session/usage.json';

function counts(patch: Record<string, number> = {}): Record<string, number> {
    return {
        inputTokens: 89192,
        outputTokens: 5173,
        cachedReadTokens: 56064,
        cacheCreationTokens: 0,
        reasoningTokens: 4712,
        totalTokens: 94365,
        modelCalls: 3,
        costUsdTicks: 2506520000,
        ...patch
    };
}

function grokUsage(turns: readonly unknown[]): string {
    return JSON.stringify({ sessionId: '01a1-session', updatedAt: '2026-10-21T09:51:56.740565+00:00', session: counts(), turns });
}

function grokTurn(turnNumber: number, endedAt: string, modelUsage: Record<string, Record<string, number>>): Record<string, unknown> {
    return { turnNumber, endedAt, ...counts(), turnCount: 1, primaryModelId: Object.keys(modelUsage)[0], modelUsage };
}

describe('the Grok reader', () => {
    test('reads a record per turn per model, with the input apart from the cache and the cost Grok reported', () => {
        const text = grokUsage([
            grokTurn(1, '2026-10-21T09:51:44.864656+00:00', { 'grok-4.7-build-fast': counts() }),
            grokTurn(2, '2026-10-21T09:51:56.740565+00:00', {
                'grok-4.7-build-fast': counts({
                    inputTokens: 35250,
                    cachedReadTokens: 34688,
                    outputTokens: 864,
                    reasoningTokens: 601,
                    modelCalls: 1,
                    costUsdTicks: 473040000
                }),
                'grok-4.7-build': counts({
                    inputTokens: 1000,
                    cachedReadTokens: 0,
                    cacheCreationTokens: 200,
                    outputTokens: 10,
                    reasoningTokens: 0,
                    modelCalls: 1,
                    costUsdTicks: 0
                })
            })
        ]);

        const records = parseGrokUsage(text, PATH)!;

        expect(
            records.map((record) => [
                record.model,
                record.totals.input,
                record.totals.cacheRead,
                record.totals.cacheWrite,
                record.totals.output,
                record.costUsd
            ])
        ).toEqual([
            ['grok-4.7-build-fast', 33128, 56064, 0, 5173, 0.250652],
            ['grok-4.7-build-fast', 562, 34688, 0, 864, 0.047304],
            // A zero cost is one Grok did not report, so the price table gets to estimate it.
            ['grok-4.7-build', 800, 0, 200, 10, undefined]
        ]);
        expect(records[0]).toMatchObject({
            provider: 'grok',
            timestampMs: Date.parse('2026-10-21T09:51:44.864656+00:00'),
            sessionId: '01a1-session',
            cwd: '/Users/bas/work repo',
            totals: { calls: 3, reasoning: 4712, cacheWrite1h: 0 }
        });
        expect(new Set(records.map((record) => record.dedupeKey)).size).toBe(3);
    });

    test('names a turn the same way on every read, so a rewrite counts it once', () => {
        const turn = grokTurn(1, '2026-10-21T09:51:44.864656+00:00', { 'grok-4.7-build-fast': counts() });
        const first = parseGrokUsage(grokUsage([turn]), PATH)!;
        const again = parseGrokUsage(grokUsage([turn, grokTurn(2, '2026-10-21T09:52:00.000000+00:00', { 'grok-4.7-build-fast': counts() })]), PATH)!;
        expect(again[0]!.dedupeKey).toBe(first[0]!.dedupeKey);
    });

    test('falls back on the turn itself without a model breakdown, and skips a turn it cannot date', () => {
        const { modelUsage: _dropped, ...plain } = grokTurn(1, '2026-10-21T09:51:44.864656+00:00', { 'grok-4.7-build': counts() });
        const records = parseGrokUsage(grokUsage([plain, grokTurn(2, 'not a time', { 'grok-4.7-build': counts() }), 'junk']), PATH)!;
        expect(records.map((record) => record.model)).toEqual(['grok-4.7-build']);
    });

    test('is null for a file that does not read as a usage file', () => {
        expect(parseGrokUsage('{"sessionId": "01a1', PATH)).toBeNull();
        expect(parseGrokUsage('[]', PATH)).toBeNull();
        expect(parseGrokUsage('{"sessionId": "01a1"}', PATH)).toBeNull();
    });
});
