import { asObject, asString, int, parseObject, type UsageRecord } from '../record.ts';

export function codexMightCarryUsage(line: string): boolean {
    return ['token_count', 'turn_context', 'session_meta', 'thread_settings_applied', 'token_usage_record', 'compacted'].some((type) => line.includes(type));
}

/* A fork replays its ancestors' events into the new file the moment it is created, so anything this
   close to the file's own start is a copy of work that was already counted somewhere else. */
const FORK_COPY_MAX_GAP_MS = 1_000;

interface CodexCounts {
    input: number;
    cached: number;
    cacheWrite: number;
    output: number;
    reasoning: number;
}

/*
 * What one file's reader has to remember between lines. A `token_count` line names neither the model
 * nor the directory, and its totals are cumulative, so a scan that resumes halfway through a file
 * needs all of it back. Everything here is JSON, so the index can store it verbatim.
 */
export interface CodexParserState {
    model: string | null;
    sessionId: string;
    cwd: string;
    /* The running cumulative total of the last line, which the next line is a delta against. */
    total: CodexCounts | null;
    sawSessionMeta: boolean;
    /* Whether this file opened as a fork or a sub-agent thread, and where its replayed prefix is. */
    suppressing: boolean;
    anchorMs: number;
    /* The last counts as they were written, so a line repeated verbatim is not counted twice. */
    lastSignature: string | null;
    serviceTier: string | null;
    pendingCompactions: Record<string, { record: UsageRecord; counts: CodexCounts; threadTotal: CodexCounts | null }>;
    compacted: string[];
    handledResponses: string[];
    latestResponse: string | null;
}

export function createCodexState(): CodexParserState {
    return {
        model: null,
        sessionId: '',
        cwd: '',
        total: null,
        sawSessionMeta: false,
        suppressing: false,
        anchorMs: 0,
        lastSignature: null,
        serviceTier: null,
        pendingCompactions: {},
        compacted: [],
        handledResponses: [],
        latestResponse: null
    };
}

export function cloneCodexState(state: CodexParserState): CodexParserState {
    return structuredClone(state);
}

function countsOf(usage: Record<string, unknown>): CodexCounts {
    return {
        input: int(usage.input_tokens),
        cached: int(usage.cached_input_tokens),
        cacheWrite: int(usage.cache_write_input_tokens),
        output: int(usage.output_tokens),
        reasoning: int(usage.reasoning_output_tokens)
    };
}

function deltaOf(total: CodexCounts, previous: CodexCounts | null): CodexCounts | null {
    if (previous === null) {
        return total;
    }
    const delta: CodexCounts = {
        input: total.input - previous.input,
        cached: total.cached - previous.cached,
        cacheWrite: total.cacheWrite - previous.cacheWrite,
        output: total.output - previous.output,
        reasoning: total.reasoning - previous.reasoning
    };
    // A compaction or a resume restarts the count, so anything falling is not a delta at all.
    return delta.input < 0 || delta.cached < 0 || delta.cacheWrite < 0 || delta.output < 0 || delta.reasoning < 0 ? null : delta;
}

/* A thread that was forked or spawned repeats its parent's events before its own work starts. */
export function isForkOrSubagent(payload: Record<string, unknown>): boolean {
    if (typeof payload.forked_from_id === 'string' || typeof payload.parent_thread_id === 'string') {
        return true;
    }
    const spawn = asObject(asObject(payload.source)?.subagent)?.thread_spawn;
    return typeof asObject(spawn)?.parent_thread_id === 'string';
}

/* Codex includes cache reads and writes in input_tokens. Compaction can appear separately from
   cumulative token_count events, so response identities prevent charging the same request twice. */
export function parseCodexLine(line: string, state: CodexParserState): UsageRecord | null {
    const record = parseObject(line);
    const payload = record === null ? null : asObject(record.payload);
    if (record === null || payload === null) {
        return null;
    }

    if (record.type === 'session_meta') {
        // A fork carries its ancestors' metas as well; only the file's own says what the file is.
        if (state.sawSessionMeta) {
            return null;
        }
        state.sawSessionMeta = true;
        state.sessionId = asString(payload.id) || asString(payload.session_id);
        state.cwd = asString(payload.cwd);
        if (isForkOrSubagent(payload)) {
            state.suppressing = true;
            state.anchorMs = Date.parse(asString(record.timestamp)) || 0;
        }
        return null;
    }

    if (record.type === 'turn_context') {
        const model = asString(payload.model);
        if (model !== '') {
            state.model = model;
        }
        const cwd = asString(payload.cwd);
        if (cwd !== '') {
            state.cwd = cwd;
        }
        return null;
    }

    if (payload.type === 'thread_settings_applied') {
        const settings = asObject(payload.thread_settings);
        if (settings !== null && typeof settings.service_tier === 'string') {
            state.serviceTier = settings.service_tier;
        }
        return null;
    }

    if (record.type === 'token_usage_record' || record.type === 'compacted') {
        return parseCompaction(record, payload, state);
    }

    if (payload.type !== 'token_count') {
        return null;
    }
    const info = asObject(payload.info);
    const total = info === null ? null : asObject(info.total_token_usage);
    if (info === null || total === null || state.model === null) {
        return null;
    }
    const timestampMs = Date.parse(asString(record.timestamp));
    if (Number.isNaN(timestampMs)) {
        return null;
    }

    const signature = JSON.stringify(info.total_token_usage);
    if (signature === state.lastSignature) {
        return null;
    }
    state.lastSignature = signature;

    const cumulative = countsOf(total);
    const last = asObject(info.last_token_usage);
    const counts = deltaOf(cumulative, state.total) ?? (last === null ? null : countsOf(last));
    state.total = cumulative;
    if (counts === null) {
        return null;
    }

    if (state.suppressing) {
        if (timestampMs - state.anchorMs <= FORK_COPY_MAX_GAP_MS) {
            state.anchorMs = timestampMs;
            return null;
        }
        // The first event that is not part of the replayed burst is this thread's own work.
        state.suppressing = false;
    }

    let dedupeKey: string | null = null;
    const pending = state.latestResponse === null ? undefined : state.pendingCompactions[state.latestResponse];
    if (pending !== undefined && (sameCounts(pending.counts, counts) || sameCounts(pending.threadTotal, cumulative))) {
        dedupeKey = `codex:response:${state.latestResponse}`;
        delete state.pendingCompactions[state.latestResponse!];
        state.handledResponses.push(state.latestResponse!);
    }
    return usageRecord(counts, timestampMs, state.model, state, dedupeKey);
}

function sameCounts(first: CodexCounts | null, second: CodexCounts): boolean {
    return (
        first !== null &&
        first.input === second.input &&
        first.cached === second.cached &&
        first.cacheWrite === second.cacheWrite &&
        first.output === second.output &&
        first.reasoning === second.reasoning
    );
}

function parseCompaction(record: Record<string, unknown>, payload: Record<string, unknown>, state: CodexParserState): UsageRecord | null {
    const id = asString(record.type === 'compacted' ? payload.compaction_response_id : payload.response_id);
    if (id === '' || state.handledResponses.includes(id)) {
        return null;
    }
    if (record.type === 'compacted') {
        if (!state.compacted.includes(id)) {
            state.compacted.push(id);
        }
    } else {
        const usage = asObject(payload.usage);
        const model = asString(payload.model) || state.model;
        const timestampMs = Date.parse(asString(record.timestamp));
        if (usage === null || model === null || !Number.isFinite(timestampMs)) {
            return null;
        }
        const counts = countsOf(usage);
        const parsed = usageRecord(counts, timestampMs, model, state, `codex:response:${id}`);
        if (parsed === null) {
            return null;
        }
        state.latestResponse = id;
        const threadTotal = asObject(payload.thread_token_usage);
        state.pendingCompactions[id] ??= { record: parsed, counts, threadTotal: threadTotal === null ? null : countsOf(threadTotal) };
    }
    const pending = state.pendingCompactions[id];
    if (!state.compacted.includes(id) || pending === undefined) {
        return null;
    }
    state.handledResponses.push(id);
    delete state.pendingCompactions[id];
    return pending.record;
}

function usageRecord(counts: CodexCounts, timestampMs: number, model: string, state: CodexParserState, dedupeKey: string | null): UsageRecord | null {
    const uncached = Math.max(0, counts.input - counts.cached - counts.cacheWrite);
    const totals = {
        calls: 1,
        input: uncached,
        cacheRead: counts.cached,
        cacheWrite: counts.cacheWrite,
        cacheWrite1h: 0,
        output: counts.output,
        reasoning: Math.min(counts.output, counts.reasoning)
    };
    if (uncached + counts.cached + counts.cacheWrite + counts.output === 0) {
        return null;
    }
    return {
        provider: 'codex',
        timestampMs,
        model,
        sessionId: state.sessionId,
        cwd: state.cwd,
        totals,
        ...(state.serviceTier === null ? {} : { serviceTier: state.serviceTier }),
        dedupeKey
    };
}
