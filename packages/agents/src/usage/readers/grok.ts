import { basename, dirname } from 'node:path';
import { asObject, asString, countsTokens, int, parseObject, type UsageRecord } from '../record.ts';

/* The file Grok keeps the counts of a session in, beside its other files in the session's folder. */
export const GROK_USAGE_FILE = 'usage.json';

// `costUsdTicks` counts in ticks of 10^-10 USD, as Grok's own docs on `grok usage` say.
const TICKS_PER_USD = 1e10;

/* The folder above a session's is its working directory, URL-encoded into one name. */
function cwdOf(path: string): string {
    try {
        return decodeURIComponent(basename(dirname(dirname(path))));
    } catch {
        return '';
    }
}

function recordOf(counts: Record<string, unknown>, model: string, base: Omit<UsageRecord, 'model' | 'totals' | 'dedupeKey'>, turn: string): UsageRecord | null {
    const cacheRead = int(counts.cachedReadTokens);
    const cacheWrite = int(counts.cacheCreationTokens);
    const totals = {
        calls: int(counts.modelCalls),
        // Grok's input holds both cache kinds: its total is input plus output.
        input: Math.max(0, int(counts.inputTokens) - cacheRead - cacheWrite),
        cacheRead,
        cacheWrite,
        cacheWrite1h: 0,
        output: int(counts.outputTokens),
        reasoning: int(counts.reasoningTokens)
    };
    if (!countsTokens(totals)) {
        return null;
    }
    const ticks = int(counts.costUsdTicks);
    return {
        ...base,
        model,
        totals,
        // A missing or zero cost is one Grok did not report, which the price table then estimates.
        ...(ticks === 0 ? {} : { costUsd: ticks / TICKS_PER_USD }),
        dedupeKey: `grok\0${base.sessionId}\0${turn}\0${model}`
    };
}

/*
 * A session's `usage.json` under `$GROK_HOME/sessions/<cwd>/<session id>/`, which Grok rewrites whole
 * at the end of every turn. One record per turn per model the turn called; null when the file does not
 * read as one, which leaves what the scanner held of it.
 */
export function parseGrokUsage(text: string, path: string): UsageRecord[] | null {
    const file = parseObject(text);
    if (file === null || !Array.isArray(file.turns)) {
        return null;
    }
    const sessionId = asString(file.sessionId) || basename(dirname(path));
    const cwd = cwdOf(path);
    const records: UsageRecord[] = [];
    for (const entry of file.turns) {
        const turn = asObject(entry);
        const timestampMs = turn === null ? Number.NaN : Date.parse(asString(turn.endedAt));
        if (turn === null || Number.isNaN(timestampMs)) {
            continue;
        }
        const number = typeof turn.turnNumber === 'number' ? String(turn.turnNumber) : asString(turn.endedAt);
        const base = { provider: 'grok' as const, timestampMs, sessionId, cwd };
        const byModel = asObject(turn.modelUsage);
        const models: Array<[string, Record<string, unknown>]> =
            byModel === null
                ? [[asString(turn.primaryModelId), turn]]
                : Object.entries(byModel).flatMap(([model, counts]) => {
                      const object = asObject(counts);
                      return object === null ? [] : [[model, object] as [string, Record<string, unknown>]];
                  });
        for (const [model, counts] of models) {
            const record = model === '' ? null : recordOf(counts, model, base, number);
            if (record !== null) {
                records.push(record);
            }
        }
    }
    return records;
}
