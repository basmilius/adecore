import type { ChatItem, ChatNoteMessage } from '@adecore/agent-contracts';
import type { ChatCore } from '../chat/chat-core.ts';
import type { Notice, NoticeStore } from './notice-store.ts';

/* The words of a message, which are the host's: it names its app, its nodes and its CLI in them. */
export interface MessageWords {
    /* What the receiving agent hears of one message: the id to act on, the title to read, and the message itself. */
    heard(notice: Notice): string;
    /* The line a person reads in the thread about one message. */
    shown(notice: Notice): string;
    /* What the CLI is sent in a turn a message opened, under the messages its preamble carries. */
    prompt(count: number): string;
    /* The label above that turn in the thread. */
    label(notices: readonly Notice[]): string;
}

/* How a chat under a node id stands, as a message on its way to it needs to know. */
export interface ChatNoticeTargets {
    /* What the host holds under this id: a chat between turns, one that is in a turn, or no chat at all. */
    chat(id: string): Promise<'idle' | 'running' | 'none'>;
    /* How many messages led to the turn this node is running; 0 for a turn no message opened. */
    hop(id: string): number;
}

/*
 * How far a chain of messages may wake chats: enough for a question, an answer and a report on each,
 * and a bound on two agents reading each other, which nothing but a person should be able to keep going.
 */
export const MAX_MESSAGE_HOPS = 4;

/* Where a turn from before hops stood: its message and the answer it could still get. */
const HOP_OF_OLDER_TURN = 2;

/*
 * Where a message for a chat went, and how many now wait for it. Only `wake` owes the chat a turn now,
 * which the host opens through a `deliver-message` entry; `in-turn` is owed one when that turn ends,
 * or may join it; every other outcome waits in the queue for the chat's next turn.
 */
export interface ChatDelivery {
    outcome: 'wake' | 'no-chat' | 'in-turn' | 'hop-limit';
    waiting: number;
}

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

/* Whether a message may still move a chat. One of an older host has no hop and waits, as it always did. */
export function withinHops(notice: Pick<Notice, 'hop'>): boolean {
    return notice.hop !== undefined && notice.hop <= MAX_MESSAGE_HOPS;
}

/* The chats of a core as a message sees them. */
export function chatNoticeTargets(chats: Pick<ChatCore, 'get' | 'hasStored'>): ChatNoticeTargets {
    return {
        chat: async (id) => {
            const session = chats.get(id);

            if (session) {
                return session.info.activeTurnId === null ? 'idle' : 'running';
            }

            // A chat nobody has loaded is idle: the turn opens on the thread the host reads back from disk.
            return (await chats.hasStored(id)) ? 'idle' : 'none';
        },
        hop: (id) => {
            const session = chats.get(id);

            return session === undefined ? 0 : turnHop(session.thread.list(), session.info.activeTurnId);
        }
    };
}

/*
 * One message on its way to a chat, and whether the chat owes a turn on it. A chat between turns gets
 * one, as for a settled task, or the message sits there until someone happens to prompt that chat.
 * Each message is one hop further than the turn that sent it, and past `MAX_MESSAGE_HOPS` it only
 * waits. A node that runs something else, such as a terminal, is the host's to deliver to before this.
 */
export async function deliverToChat(
    store: Pick<NoticeStore, 'put'>,
    targets: ChatNoticeTargets,
    notice: Omit<Notice, 'createdAt' | 'hop'>
): Promise<ChatDelivery> {
    const hop = targets.hop(notice.from) + 1;
    const waiting = await store.put({ ...notice, hop });
    const chat = await targets.chat(notice.targetId);

    if (chat === 'none') {
        return { outcome: 'no-chat', waiting };
    }

    if (hop > MAX_MESSAGE_HOPS) {
        return { outcome: 'hop-limit', waiting };
    }

    return { outcome: chat === 'running' ? 'in-turn' : 'wake', waiting };
}

/* The chat a message may join while it runs. False when it cannot take one now, which leaves the message waiting. */
export interface SteerChat {
    steer(chatId: string, steer: { text: string; preamble: string; messageHop: number }): Promise<boolean>;
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
            const batch = store.waiting(targetId).filter(withinHops);

            if (batch.length === 0) {
                return;
            }

            const accepted = await chat.steer(targetId, {
                text: words.prompt(batch.length),
                preamble: batch.map((notice) => words.heard(notice)).join('\n\n'),
                messageHop: Math.max(...batch.map((notice) => notice.hop ?? 0))
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
    return { from: notice.from, title: notice.fromTitle, text: notice.text, state: 'waiting' };
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
