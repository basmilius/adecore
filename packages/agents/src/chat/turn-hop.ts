import type { ChatItem } from '@adecore/agent-contracts';

/* Where a turn from before hops stood: its message and the answer it could still get. */
const HOP_OF_OLDER_TURN = 2;

/*
 * How many messages led to the turn a chat is running. It rides on the turn, so it survives a restart.
 * Between turns the last one counts, since work it left running (a background subagent) may still
 * write, and a turn the CLI opened by itself takes the step of the turn before it.
 */
export function turnHop(items: readonly ChatItem[], activeTurnId: string | null): number {
    const from = activeTurnId === null ? items.findLastIndex((item) => item.kind === 'turn') : items.findIndex((item) => item.id === activeTurnId);

    for (let i = from; i >= 0; i--) {
        const turn = items[i]!;

        if (turn.kind !== 'turn') {
            continue;
        }

        if (turn.messageHop !== undefined) {
            return turn.messageHop;
        }

        if ((turn.messageFrom ?? []).length > 0) {
            return HOP_OF_OLDER_TURN;
        }

        if (turn.origin !== 'agent' || turn.taskIds !== undefined || turn.summaryFor !== undefined) {
            return 0;
        }
    }

    return 0;
}
