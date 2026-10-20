import type { UsageProvider } from '@adecore/agent-contracts';
import { asObject, asString, int, type UsageRecord } from '../record.ts';

/*
 * One call to an API a host makes itself, a line of the usage log it keeps. Such an API has no CLI and so
 * no transcript, so the host writes this line for each call and the scanner reads the folder like one.
 * The kinds are disjoint, as they are in a record: `input` is what was neither read from nor written to
 * a cache, and `reasoning` is a part of `output`. Each host maps the counts of its own API onto them, since
 * the APIs do not agree: some report a prompt that holds its cached part, some report the input apart from both
 * cache kinds, and only some have a cache write at all.
 */
export interface ApiUsageEntry {
    at: number;
    model: string;
    session: string;
    cwd: string;
    input: number;
    cacheRead: number;
    cacheWrite: number;
    output: number;
    reasoning: number;
}

export function apiUsageLine(entry: ApiUsageEntry): string {
    return `${JSON.stringify(entry)}\n`;
}

/* A line of this log names its model, which keeps `JSON.parse` off anything else a folder holds. */
export function apiLogMightCarryUsage(line: string): boolean {
    return line.includes('"model"');
}

/* The provider is the root's, so one reader serves every API a host logs. */
export function parseApiLogLine(line: string, provider: UsageProvider): UsageRecord | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(line);
    } catch {
        return null;
    }
    const entry = asObject(parsed);
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
    if (totals.input + totals.cacheRead + totals.cacheWrite + totals.output === 0) {
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
