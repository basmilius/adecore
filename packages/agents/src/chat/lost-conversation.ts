import type { ChatItem } from '@adecore/agent-contracts';
import type { BackendEvent } from '../backends/backend.ts';
import { renderTranscript } from '../context/transcript.ts';
import { fenced } from './projector.ts';

// What Claude Code answers a `--resume` whose transcript is gone, in its error result and on stderr.
const CONVERSATION_NOT_FOUND = 'No conversation found with session ID:';

// The thread as text costs the first prompt of the new session; the last turn always goes along, however long.
const HANDOFF_BYTES = 24 * 1024;

const LOST_CONVERSATION_NOTE =
    'Claude Code could not resume this conversation: its transcript is gone. Send your message again to go on in a new session, which reads this thread as text first.';

const encoder = new TextEncoder();

/* The note a person reads under the send that found the conversation gone; the CLI's own words fold open below it. */
export function lostConversationNote(said: string): string {
    return `${LOST_CONVERSATION_NOTE}\n\n${fenced(said.trim())}`;
}

/* Whether a backend event is Claude Code refusing a resume, as an error result or as an exit that wrote only stderr. */
export function namesLostConversation(event: BackendEvent): event is Extract<BackendEvent, { type: 'turn.done' | 'exit' }> {
    if (event.type === 'turn.done') {
        return event.state === 'error' && event.error?.includes(CONVERSATION_NOT_FOUND) === true;
    }

    return event.type === 'exit' && event.stderr?.includes(CONVERSATION_NOT_FOUND) === true;
}

/*
 * What a new session hears in front of its first prompt after the old one was lost: the thread's last
 * whole turns as text, from the newest back until the budget is spent. `failedTurnId` is the send that
 * found the conversation gone, which the CLI never read.
 */
export function lostConversationHandoff(items: readonly ChatItem[], failedTurnId: string | null): string | null {
    const byTurn = new Map<string, ChatItem[]>();

    for (const item of items) {
        if (item.turnId === null || item.turnId === failedTurnId) {
            continue;
        }

        byTurn.set(item.turnId, [...(byTurn.get(item.turnId) ?? []), item]);
    }

    const rendered = [...byTurn.values()].map((turn) => renderTranscript(turn)).filter((text) => text !== '');

    if (rendered.length === 0) {
        return null;
    }

    const kept: string[] = [];
    let bytes = 0;

    for (const text of rendered.toReversed()) {
        const size = encoder.encode(text).length + 2;

        if (kept.length > 0 && bytes + size > HANDOFF_BYTES) {
            break;
        }

        kept.unshift(text);
        bytes += size;
    }

    const part = kept.length === rendered.length ? 'all of it' : `its last ${kept.length === 1 ? 'turn' : `${kept.length} turns`}`;

    return [
        'This chat went on in an earlier session whose conversation could not be resumed, so you start fresh in it.',
        `What follows is ${part}, as text. The tool lines are what ran then, so check the files before you assume.`,
        '---',
        kept.join('\n\n'),
        '---',
        "Continue from here. The person's next message follows."
    ].join('\n');
}
