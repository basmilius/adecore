import type { UsageProvider } from '@adecore/agent-contracts';
import { asString, countsTokens, int, parseObject, type UsageRecord } from '../record.ts';

/* A line of the log `hostUsageLine` writes names its model, which keeps `JSON.parse` off anything else a folder holds. */
export function hostLogMightCarryUsage(line: string): boolean {
    return line.includes('"model"');
}

/* The provider is the root's, so one reader serves every API a host logs. */
export function parseHostUsageLine(line: string, provider: UsageProvider): UsageRecord | null {
    const entry = parseObject(line);

    if (entry === null) {
        return null;
    }

    const model = asString(entry.model);
    const timestampMs = typeof entry.at === 'number' && Number.isFinite(entry.at) ? entry.at : Number.NaN;

    if (model === '' || Number.isNaN(timestampMs)) {
        return null;
    }

    const totals = {
        calls: 1,
        input: int(entry.input),
        cacheRead: int(entry.cacheRead),
        cacheWrite: int(entry.cacheWrite),
        cacheWrite1h: 0,
        output: int(entry.output),
        reasoning: int(entry.reasoning)
    };

    if (!countsTokens(totals)) {
        return null;
    }

    return {
        provider,
        timestampMs,
        model,
        sessionId: asString(entry.session),
        cwd: asString(entry.cwd),
        totals,
        // Every line is a call of its own, so nothing is folded.
        dedupeKey: null
    };
}
