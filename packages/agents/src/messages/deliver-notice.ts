import type { ChatNoteMessage } from '@adecore/agent-contracts';
import type { ChatCore } from '../chat/chat-core.ts';
import { messagesMayWake } from './message-turns.ts';
import type { Notice, NoticeStore } from './notice-store.ts';

/* The words of a message, which are the host's: it names its app, its nodes and its CLI in them. */
export interface MessageWords {
    /* What the receiving agent hears of one message: the id to act on, the title to read, and the message itself. */
    heard(notice: Notice): string;
    shown(notice: Notice): string;
    /* What the CLI is sent in a turn a message opened, under the messages its preamble carries, so it can name who sent them. */
    prompt(count: number, notices: readonly Notice[]): string;
    /* The label above that turn in the thread. */
    label(notices: readonly Notice[]): string;
}

/* How a chat under a node id stands, as a message on its way to it needs to know. */
export interface ChatNoticeTargets {
    /* What the host holds under this id: a chat between turns, one that is in a turn, or no chat at all. */
    chat(id: string): Promise<'idle' | 'running' | 'none'>;
    /* Whether messages may still open a turn in the chat under this id (`messagesMayWake`). */
    mayWake(id: string): boolean;
}

/*
 * Where a message for a chat went, and how many now wait for it. Only `wake` owes the chat a turn now,
 * which the host opens through a `deliver-message` entry; `in-turn` is owed one when that turn ends,
 * or may join it; every other outcome waits in the queue for the chat's next turn.
 */
export interface ChatDelivery {
    outcome: 'wake' | 'no-chat' | 'in-turn' | 'rate-limit';
    waiting: number;
}

/* The chats of a core as a message sees them. */
export function chatNoticeTargets(chats: Pick<ChatCore, 'get' | 'hasStored'>, now: () => number = Date.now): ChatNoticeTargets {
    return {
        chat: async (id) => {
            const session = chats.get(id);

            if (session) {
                return session.info.activeTurnId === null ? 'idle' : 'running';
            }

            // A chat nobody has loaded is idle: the turn opens on the thread the host reads back from disk.
            return (await chats.hasStored(id)) ? 'idle' : 'none';
        },
        // A chat nobody has loaded opened no turn since the host started, as far as it can tell.
        mayWake: (id) => {
            const session = chats.get(id);

            return session === undefined || messagesMayWake(session.thread.list(), now());
        }
    };
}

/*
 * One message on its way to a chat, and whether the chat owes a turn on it. A chat between turns gets
 * one, as for a settled task, or the message sits there until someone happens to prompt that chat.
 * Once messages opened `MAX_MESSAGE_TURNS` turns there within the hour, a message only waits, marked
 * so a person sees why. A node that runs something else, such as a terminal, is the host's to deliver
 * to before this.
 */
export async function deliverToChat(
    store: Pick<NoticeStore, 'put'>,
    targets: ChatNoticeTargets,
    notice: Omit<Notice, 'createdAt' | 'hop' | 'limited'>
): Promise<ChatDelivery> {
    const chat = await targets.chat(notice.targetId);
    const limited = chat === 'idle' && !targets.mayWake(notice.targetId);
    const waiting = await store.put(limited ? { ...notice, limited } : notice);

    if (chat === 'none') {
        return { outcome: 'no-chat', waiting };
    }

    if (limited) {
        return { outcome: 'rate-limit', waiting };
    }

    return { outcome: chat === 'running' ? 'in-turn' : 'wake', waiting };
}

/* The chat a message may join while it runs. False when it cannot take one now, which leaves the message waiting. */
interface SteerChat {
    steer(chatId: string, steer: { text: string; preamble: string }): Promise<boolean>;
}

const steering = new Set<string>();

/*
 * Hands what waits for a running chat to its running turn, one batch at a time per chat, so a message
 * landing during a slow acknowledgement goes in the next batch and not twice. What the CLI did not take
 * stays in the queue, for the turn that opens when this one ends.
 */
export async function steerNotices(
    store: Pick<NoticeStore, 'waiting' | 'remove'>,
    chat: SteerChat,
    words: Pick<MessageWords, 'heard' | 'prompt'>,
    targetId: string
): Promise<void> {
    if (steering.has(targetId)) {
        return;
    }

    steering.add(targetId);

    try {
        for (;;) {
            const batch = store.waiting(targetId);

            if (batch.length === 0) {
                return;
            }

            const accepted = await chat.steer(targetId, {
                text: words.prompt(batch.length, batch),
                preamble: batch.map((notice) => words.heard(notice)).join('\n\n')
            });

            if (!accepted) {
                return;
            }

            await store.remove(targetId, batch);
        }
    } finally {
        steering.delete(targetId);
    }
}

/* The chat a message was left for, as the two things showing it needs: whether it is there, and a line in its thread. */
export interface NoticeChat {
    /* Whether the host holds a chat under the id, running or on disk. */
    has(id: string): Promise<boolean>;
    /* Puts a line in that chat's thread, loading the chat when nobody has. */
    note(id: string, text: string, message: ChatNoteMessage): Promise<void>;
}

/* The message itself on the line in the thread, so a client can draw it as said to the chat. */
export function noticeMessage(notice: Notice): ChatNoteMessage {
    return { from: notice.from, title: notice.fromTitle, text: notice.text, state: 'waiting', ...(notice.limited === true ? { limited: true } : {}) };
}

/*
 * Shows a person the message in the chat's thread the moment it lands, not when the model gets round
 * to it. An id no chat holds shows and marks nothing, so a chat that opens on it later still has all of it.
 */
export async function showNotices(store: Pick<NoticeStore, 'show'>, chat: NoticeChat, words: Pick<MessageWords, 'shown'>, targetId: string): Promise<void> {
    if (!(await chat.has(targetId))) {
        return;
    }

    for (const notice of await store.show(targetId)) {
        await chat.note(targetId, words.shown(notice), noticeMessage(notice));
    }
}
