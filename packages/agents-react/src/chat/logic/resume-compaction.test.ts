import { expect, test } from 'bun:test';
import type { ChatInfo, ChatItem } from '@adecore/agent-contracts';
import {
    RESUME_COMPACTION_IDLE_MS,
    RESUME_COMPACTION_TOKENS,
    resumeCompactionDueAt,
    resumeCompactionOffer,
    watchDueAt,
    type DueClock
} from './resume-compaction';

const NOW = 1_800_000_000_000;
const ENDED = NOW - RESUME_COMPACTION_IDLE_MS;

function info(patch: Partial<ChatInfo> = {}): ChatInfo {
    return {
        chatId: 'chat-1',
        provider: 'claude',
        cwd: '/tmp/project',
        agentSessionId: 'session-1',
        model: 'claude-opus-5',
        selection: { model: 'claude-opus-5', options: {} },
        runtimeMode: 'supervised',
        status: 'idle',
        running: true,
        activeTurnId: null,
        slashCommands: [],
        usage: { contextTokens: RESUME_COMPACTION_TOKENS, contextWindow: 1_000_000, costUsd: 1, turns: 4 },
        createdAt: 0,
        ...patch
    };
}

function turn(id: string, endedAt: number | null, createdAt = 0): ChatItem {
    return {
        id,
        kind: 'turn',
        createdAt,
        turnId: id,
        state: endedAt === null ? 'running' : 'done',
        endedAt,
        costUsd: 0
    };
}

function compaction(turnId: string): ChatItem {
    return { id: `compaction-${turnId}`, kind: 'compaction', createdAt: 0, turnId, preTokens: 180_000 };
}

function offer(patch: Partial<Parameters<typeof resumeCompactionOffer>[0]> = {}) {
    return resumeCompactionOffer({ info: info(), compaction: 'prompt', items: [turn('turn-1', ENDED)], dismissedTurnId: null, now: NOW, ...patch });
}

test('a quiet chat with enough context is offered a compaction, and the offer names the turn it is about', () => {
    expect(offer()).toEqual({ turnId: 'turn-1', tokens: RESUME_COMPACTION_TOKENS, reason: 'idle' });
    expect(offer({ compaction: 'native' })).toEqual({ turnId: 'turn-1', tokens: RESUME_COMPACTION_TOKENS, reason: 'idle' });
});

test('a provider that cannot compact is never offered it, and neither is one whose capabilities did not arrive', () => {
    expect(offer({ compaction: 'none' })).toBeNull();
    expect(offer({ compaction: undefined })).toBeNull();
});

test('the token threshold is a floor, not a ceiling', () => {
    expect(offer({ info: info({ usage: { contextTokens: RESUME_COMPACTION_TOKENS - 1, contextWindow: 200_000, costUsd: 1, turns: 4 } }) })).toBeNull();
    expect(offer({ info: info({ usage: { contextTokens: 400_000, contextWindow: 1_000_000, costUsd: 1, turns: 4 } }) })?.tokens).toBe(400_000);
});

test('the idle threshold is a floor too, and a turn still running has no end to measure from', () => {
    expect(offer({ now: ENDED + RESUME_COMPACTION_IDLE_MS - 1 })).toBeNull();
    expect(offer({ items: [turn('turn-1', null)] })).toBeNull();
    expect(offer({ items: [] })).toBeNull();
});

test('a chat that is working or has a message waiting is left alone', () => {
    expect(offer({ info: info({ activeTurnId: 'turn-2' }) })).toBeNull();
    expect(offer({ info: info({ queue: [{ id: 'queued-1', text: 'later', createdAt: 0 }] }) })).toBeNull();
});

test('a turn that already compacted is not offered it again, in either shape', () => {
    expect(offer({ items: [turn('turn-1', ENDED), compaction('turn-1')] })).toBeNull();

    expect(offer({ items: [turn('turn-1', ENDED), compaction('turn-0'), turn('turn-2', ENDED)] })).toEqual({
        turnId: 'turn-2',
        tokens: RESUME_COMPACTION_TOKENS,
        reason: 'idle'
    });
});

test('keeping the full history holds for that turn only', () => {
    expect(offer({ dismissedTurnId: 'turn-1' })).toBeNull();
    expect(offer({ dismissedTurnId: 'turn-0' })).toEqual({ turnId: 'turn-1', tokens: RESUME_COMPACTION_TOKENS, reason: 'idle' });

    expect(offer({ items: [turn('turn-1', ENDED), turn('turn-2', ENDED)], dismissedTurnId: 'turn-1' })).toEqual({
        turnId: 'turn-2',
        tokens: RESUME_COMPACTION_TOKENS,
        reason: 'idle'
    });
});

const USAGE = { contextTokens: RESUME_COMPACTION_TOKENS, contextWindow: 1_000_000, costUsd: 1, turns: 4 };

test('a cache with a known expiry goes cold at that moment, not after the idle stretch', () => {
    const expires = NOW - 60_000;
    const cold = info({ usage: { ...USAGE, cacheTtlMs: 300_000, cacheExpiresAt: expires } });
    const items = [turn('turn-1', expires - 120_000)];
    expect(offer({ info: cold, items, now: expires - 1 })).toBeNull();
    expect(offer({ info: cold, items, now: expires })).toEqual({ turnId: 'turn-1', tokens: RESUME_COMPACTION_TOKENS, reason: 'cache-expired' });
});

test('a cache that is still warm keeps the offer back, however long the chat lay still', () => {
    const warm = info({ usage: { ...USAGE, cacheTtlMs: 3_600_000, cacheExpiresAt: NOW + 1 } });
    expect(offer({ info: warm, items: [turn('turn-1', NOW - 2 * RESUME_COMPACTION_IDLE_MS)] })).toBeNull();
});

test('the offer comes due when the cache expires, or after the idle stretch from a CLI that names no expiry, and not at all while none could be made', () => {
    const items = [turn('turn-1', ENDED)];
    const expires = ENDED + 300_000;

    expect(resumeCompactionDueAt({ info: info({ usage: { ...USAGE, cacheExpiresAt: expires } }), compaction: 'prompt', items, dismissedTurnId: null })).toBe(
        expires
    );

    expect(resumeCompactionDueAt({ info: info(), compaction: 'prompt', items, dismissedTurnId: null })).toBe(ENDED + RESUME_COMPACTION_IDLE_MS);
    expect(resumeCompactionDueAt({ info: info(), compaction: 'none', items, dismissedTurnId: null })).toBeNull();
    expect(resumeCompactionDueAt({ info: info(), compaction: 'prompt', items, dismissedTurnId: 'turn-1' })).toBeNull();
});

test('the last turn is the one that started last, wherever the thread has it', () => {
    const items = [turn('turn-2', null, 20), turn('turn-1', ENDED, 10)];
    expect(offer({ items })).toBeNull();
    expect(offer({ items: [turn('turn-2', ENDED, 20), turn('turn-1', ENDED, 10)] })?.turnId).toBe('turn-2');
});

/* A clock whose timers and wakes a test runs by hand. */
function fakeClock(start: number) {
    let now = start;
    let timer: { run: () => void; at: number } | null = null;
    let wake: (() => void) | null = null;

    const clock: DueClock = {
        now: () => now,
        setTimer: (run, ms) => {
            timer = { run, at: now + ms };

            return timer;
        },
        clearTimer: (cleared) => {
            if (timer === cleared) {
                timer = null;
            }
        },
        onWake: (listener) => {
            wake = listener;

            return () => {
                wake = null;
            };
        }
    };

    return {
        clock,
        set: (time: number) => {
            now = time;
        },
        fire: () => {
            const fired = timer;
            timer = null;
            fired?.run();
        },
        wake: () => wake?.(),
        armedAt: () => timer?.at ?? null
    };
}

test('a timer that fires early is armed again until the offer is due', () => {
    const fake = fakeClock(0);
    const due: number[] = [];
    watchDueAt(1000, (now) => due.push(now), fake.clock);
    expect(fake.armedAt()).toBe(1000);
    fake.set(995);
    fake.fire();
    expect(due).toEqual([]);
    expect(fake.armedAt()).toBe(1000);
    fake.set(1000);
    fake.fire();
    expect(due).toEqual([1000]);
    expect(fake.armedAt()).toBeNull();
});

test('a wake after the system slept past the moment says so at once, and only once', () => {
    const fake = fakeClock(0);
    const due: number[] = [];
    watchDueAt(1000, (now) => due.push(now), fake.clock);
    // The timer has not fired yet: a monotonic clock stood still while the system slept.
    fake.set(5000);
    fake.wake();
    expect(due).toEqual([5000]);
    expect(fake.armedAt()).toBeNull();
    fake.wake();
    expect(due).toEqual([5000]);
});

test('a wake before the moment arms the timer for what is left, and a stopped watch says nothing', () => {
    const fake = fakeClock(0);
    const due: number[] = [];
    const stop = watchDueAt(1000, (now) => due.push(now), fake.clock);
    fake.set(400);
    fake.wake();
    expect(fake.armedAt()).toBe(1000);
    stop();
    expect(fake.armedAt()).toBeNull();
    fake.set(2000);
    fake.wake();
    expect(due).toEqual([]);
});
