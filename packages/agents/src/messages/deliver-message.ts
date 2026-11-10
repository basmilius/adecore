import { z } from 'zod';
import type { WakeChat } from '../chat/wake-chat.ts';
import type { OutboxOutcome } from '../outbox/outbox-worker.ts';
import type { OutboxEntryOf } from '../outbox/outbox.ts';
import type { MessageWords } from './deliver-notice.ts';
import { messagesMayWake } from './message-turns.ts';
import type { NoticeStore } from './notice-store.ts';

export const DeliverMessageWorkSchema = z.object({
    kind: z.literal('deliver-message'),
    // The target is the chat the message was left for; the message itself waits in the notice store, with any that came in beside it.
    payload: z.object({ from: z.string().min(1) })
});

export type DeliverMessageWork = z.infer<typeof DeliverMessageWorkSchema>;
export type DeliverMessageEntry = OutboxEntryOf<DeliverMessageWork>;

export interface DeliverMessageDeps {
    notices: Pick<NoticeStore, 'waiting'>;
    /* The chat the message was left for, loaded from disk when nobody has it; null for a node with no thread. */
    chat(chatId: string): Promise<WakeChat | null>;
    /* Whether a project still places the node; one that is gone reads nothing any more. */
    placed(nodeId: string): boolean;
    words: Pick<MessageWords, 'prompt' | 'label'>;
    now?: () => number;
}

/*
 * Opens the turn a message earns a chat. The messages wait in the notice store and the turn's preamble
 * takes them (`NoticeNotes`), as a person's own prompt does, so a message is heard once either way.
 *
 * One attempt: a chat already in a turn reads the message in front of its next one, and holding the
 * entry would start turns nobody asked for long after the news mattered. The exceptions are a chat
 * being moved to another folder and an idle chat that turns the wake away: neither has a turn whose
 * end would owe the wake again.
 */
export function deliverMessageHandler(deps: DeliverMessageDeps) {
    return async (entry: DeliverMessageEntry): Promise<OutboxOutcome> => {
        if (!deps.placed(entry.target)) {
            return;
        }

        const waiting = deps.notices.waiting(entry.target);

        // A turn opened for an earlier message took these along, or they went stale: nothing to wake anyone for.
        if (waiting.length === 0) {
            return;
        }

        const chat = await deps.chat(entry.target);

        if (chat === null) {
            return;
        }

        if (chat.relocating?.() === true) {
            return 'wait';
        }

        // No note and no preamble on the thread: a person read the message as it landed (`showNotices`),
        // and the label on the turn names who it came from.
        // Past the limit the messages wait for a turn of the chat's own, which takes them in its preamble.
        if (!messagesMayWake(chat.items(), (deps.now ?? Date.now)())) {
            return;
        }

        const woken = chat.wake({
            text: deps.words.prompt(waiting.length, waiting),
            label: deps.words.label(waiting),
            taskIds: [],
            messageFrom: [...new Set(waiting.map((notice) => notice.from))]
        });

        // An idle chat that turned the wake away (a process waiting to be replaced, an owed resume) has
        // no turn ending that would owe it again, so it waits for the chat to be free instead.
        if (!woken && chat.inTurn?.() === false) {
            return 'wait';
        }
    };
}
