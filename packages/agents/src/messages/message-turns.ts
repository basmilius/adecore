import type { ChatItem } from '@adecore/agent-contracts';

/*
 * How many turns messages of other agents may open in one chat within `MESSAGE_TURN_WINDOW_MS`. Agents
 * that work together get far more than they need; two agents that only answer each other stop within
 * the hour, which nothing but a person should be able to keep going.
 */
export const MAX_MESSAGE_TURNS = 30;
export const MESSAGE_TURN_WINDOW_MS = 60 * 60 * 1000;

/* The turns messages of other agents opened in a chat within the window. They ride on the thread, so the count survives a restart. */
export function messageTurns(items: readonly ChatItem[], now: number): number {
    const since = now - MESSAGE_TURN_WINDOW_MS;

    return items.filter((item) => item.kind === 'turn' && item.origin === 'agent' && (item.messageFrom ?? []).length > 0 && item.createdAt >= since).length;
}

/* Whether messages may still open a turn in a chat with these items. */
export function messagesMayWake(items: readonly ChatItem[], now: number): boolean {
    return messageTurns(items, now) < MAX_MESSAGE_TURNS;
}
