import type { ChatInfo, ChatItem, ProviderCapabilities } from '@adecore/agent-contracts';

/*
 * An absolute count, not a share of the window: reading a thread again costs per token, so 100k in a
 * window of 1M is as expensive as 100k in a window of 200k.
 */
export const RESUME_COMPACTION_TOKENS = 100_000;

/* The longest prompt cache Claude keeps is an hour, so past this the whole thread is read again anyway. */
export const RESUME_COMPACTION_IDLE_MS = 70 * 60_000;

/* `cache-expired` when the CLI named when its prompt cache goes cold, `idle` when only the silence says so. */
export type ResumeCompactionReason = 'cache-expired' | 'idle';

export interface ResumeCompactionOffer {
    /* The turn the offer is about, and the key "Keep full history" is remembered under. */
    turnId: string;
    tokens: number;
    reason: ResumeCompactionReason;
}

type Turn = Extract<ChatItem, { kind: 'turn' }>;

interface OfferInput {
    info: ChatInfo;
    /* Absent until the host answered `provider.list`. */
    compaction: ProviderCapabilities['compaction'] | undefined;
    items: readonly ChatItem[];
    dismissedTurnId: string | null;
}

/* The newest turn by when it started, so a thread that arrives out of order still names the turn that ran last. */
function lastTurn(items: readonly ChatItem[]): Turn | null {
    let last: Turn | null = null;
    for (const item of items) {
        if (item.kind === 'turn' && (last === null || item.createdAt >= last.createdAt)) {
            last = item;
        }
    }
    return last;
}

/* The turn an offer would be about, or null while nothing could be offered whatever the time. */
function offerableTurn({ info, compaction, items, dismissedTurnId }: OfferInput): Turn | null {
    if (compaction === undefined || compaction === 'none') {
        return null;
    }
    if (info.activeTurnId !== null || (info.queue ?? []).length > 0) {
        return null;
    }
    if (info.usage.contextTokens < RESUME_COMPACTION_TOKENS) {
        return null;
    }
    const turn = lastTurn(items);
    if (turn === null || turn.endedAt === null || turn.id === dismissedTurnId) {
        return null;
    }
    // `contextTokens` keeps the old number until the next request, so the offer would return right after
    // a compaction. A native one is a turn without a message of the person, hence the look at the turn.
    if (items.some((item) => item.kind === 'compaction' && item.turnId === turn.id)) {
        return null;
    }
    return turn;
}

/* A silence longer than any cache lives stands in for an expiry from a CLI that names none. */
function dueAtOf(info: ChatInfo, endedAt: number): number {
    return info.usage.cacheExpiresAt ?? endedAt + RESUME_COMPACTION_IDLE_MS;
}

/*
 * When the next message would pay for the whole thread again, or null while nothing could be offered,
 * so a surface knows whether to keep a timer.
 */
export function resumeCompactionDueAt(input: OfferInput): number | null {
    const endedAt = offerableTurn(input)?.endedAt ?? null;
    return endedAt === null ? null : dueAtOf(input.info, endedAt);
}

/* Whether to offer compacting before the next message. */
export function resumeCompactionOffer(input: OfferInput & { now: number }): ResumeCompactionOffer | null {
    const turn = offerableTurn(input);
    if (turn === null || turn.endedAt === null || input.now < dueAtOf(input.info, turn.endedAt)) {
        return null;
    }
    return {
        turnId: turn.id,
        tokens: input.info.usage.contextTokens,
        reason: input.info.usage.cacheExpiresAt === undefined ? 'idle' : 'cache-expired'
    };
}

/* What `watchDueAt` keeps time with; a test hands in a fake. */
export interface DueClock {
    now(): number;
    setTimer(run: () => void, ms: number): unknown;
    clearTimer(timer: unknown): void;
    /* Calls `wake` when the page may have slept or sat in the background, and answers how to stop. */
    onWake(wake: () => void): () => void;
}

/*
 * Calls `due` with the time once `dueAt` passed. A timer can fire a few milliseconds early, and one that runs on a
 * monotonic clock fires late after the system slept, so an early timer is armed again and a wake looks at once.
 */
export function watchDueAt(dueAt: number, due: (now: number) => void, clock: DueClock): () => void {
    let timer: unknown = null;
    let done = false;
    const check = (): void => {
        if (timer !== null) {
            clock.clearTimer(timer);
            timer = null;
        }
        if (done) {
            return;
        }
        const now = clock.now();
        if (now >= dueAt) {
            done = true;
            due(now);
            return;
        }
        timer = clock.setTimer(() => {
            timer = null;
            check();
        }, dueAt - now);
    };
    const stopWake = clock.onWake(check);
    check();
    return () => {
        done = true;
        stopWake();
        if (timer !== null) {
            clock.clearTimer(timer);
        }
    };
}
