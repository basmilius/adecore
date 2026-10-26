import { describe, expect, test } from 'bun:test';
import { hostLogMightCarryUsage, hostUsageLine, parseHostUsageLine } from './host-log.ts';

const entry = {
    at: Date.parse('2026-10-20T09:00:00.000Z'),
    model: 'z-ai/glm-5.3',
    session: 's-1',
    cwd: '/work/repo',
    input: 1000,
    cacheRead: 200,
    cacheWrite: 50,
    output: 300,
    reasoning: 120
};

describe('the log of an API a host calls itself', () => {
    test('a line a host wrote is read back as one call, with every kind of token as it was counted', () => {
        const record = parseHostUsageLine(hostUsageLine(entry).trim(), 'nanogpt');

        expect(record).toMatchObject({
            provider: 'nanogpt',
            model: 'z-ai/glm-5.3',
            sessionId: 's-1',
            cwd: '/work/repo',
            timestampMs: entry.at,
            dedupeKey: null
        });
        // A cache write has a place, since some APIs bill it above the input.
        expect(record!.totals).toEqual({ calls: 1, input: 1000, cacheRead: 200, cacheWrite: 50, cacheWrite1h: 0, output: 300, reasoning: 120 });
    });

    test('the provider is the root the log was found in, whatever the host that wrote it', () => {
        expect(parseHostUsageLine(hostUsageLine(entry), 'nanogpt')!.provider).toBe('nanogpt');
        expect(parseHostUsageLine(hostUsageLine(entry), 'claude')!.provider).toBe('claude');
    });

    test('a count that is missing or not a number is zero, and a call that counted nothing is not a call', () => {
        expect(parseHostUsageLine(JSON.stringify({ at: entry.at, model: 'm', input: 'many', output: 7 }), 'nanogpt')!.totals).toMatchObject({
            input: 0,
            output: 7
        });
        expect(parseHostUsageLine(hostUsageLine({ ...entry, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 }), 'nanogpt')).toBeNull();
    });

    test('a cache write alone is a call, since it was billed', () => {
        expect(parseHostUsageLine(hostUsageLine({ ...entry, input: 0, cacheRead: 0, output: 0, reasoning: 0 }), 'nanogpt')!.totals.cacheWrite).toBe(50);
    });

    test('a line without a model or a moment, and noise, are not calls', () => {
        expect(parseHostUsageLine(JSON.stringify({ ...entry, model: '' }), 'nanogpt')).toBeNull();
        expect(parseHostUsageLine(JSON.stringify({ ...entry, at: 'yesterday' }), 'nanogpt')).toBeNull();
        expect(parseHostUsageLine('not json', 'nanogpt')).toBeNull();
        expect(parseHostUsageLine('[1,2]', 'nanogpt')).toBeNull();
    });

    test('only a line that names a model is worth parsing', () => {
        expect(hostLogMightCarryUsage(hostUsageLine(entry))).toBe(true);
        expect(hostLogMightCarryUsage('{"hello":"world"}')).toBe(false);
    });
});
