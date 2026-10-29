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
    /* The senders whose message opened the turn this node is running, empty for a turn no message opened. */
    wokenBy(id: string): readonly string[];
}

/*
 * Where a message for a chat went, and how many now wait for it. Only `wake` owes the chat a turn,
 * which the host opens through a `deliver-message` entry; every other outcome waits in the queue for
 * the chat's next turn.
 */
export interface ChatDelivery {
    outcome: 'wake' | 'no-chat' | 'in-turn' | 'from-message';
    waiting: number;
}

/*
 * Who sent the message that opened the turn a chat is running, empty when no message opened it,
 * which stops two agents that read each other from waking each other forever. It rides on the turn,
 * so it survives a restart. Between turns the last one counts, since work it left running (a
 * background subagent) may still write, and a turn the CLI opened by itself takes the step of the
 * turn before it.
 */
export function turnWokenBy(items: readonly ChatItem[], activeTurnId: string | null): readonly string[] {
    const from = activeTurnId === null ? items.findLastIndex((item) => item.kind === 'turn') : items.findIndex((item) => item.id === activeTurnId);

    for (let i = from; i >= 0; i--) {
        const turn = items[i]!;

        if (turn.kind !== 'turn') {
            continue;
        }

        const senders = turn.messageFrom ?? [];

        if (senders.length > 0) {
            return senders;
        }

        if (turn.origin !== 'agent' || turn.taskIds !== undefined || turn.summaryFor !== undefined) {
            return [];
        }
    }

    return [];
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
        wokenBy: (id) => {
            const session = chats.get(id);

            return session === undefined ? [] : turnWokenBy(session.thread.list(), session.info.activeTurnId);
        }
    };
}

/*
 * One message on its way to a chat, and whether the chat owes a turn on it. A chat between turns gets
 * one, as for a settled task, or the message sits there until someone happens to prompt that chat.
 * A turn a message opened wakes nobody with a message of its own, except the sender it answers,
 * once: only while that sender's own turn was opened by no message, so a question and its answer
 * take two steps and the turn the answer opens wakes nobody. A node that runs something else, such
 * as a terminal, is the host's to deliver to before this.
 */
export async function deliverToChat(store: Pick<NoticeStore, 'put'>, targets: ChatNoticeTargets, notice: Omit<Notice, 'createdAt'>): Promise<ChatDelivery> {
    const waiting = await store.put(notice);
    const chat = await targets.chat(notice.targetId);

    if (chat === 'none') {
        return { outcome: 'no-chat', waiting };
    }

    if (chat === 'running') {
        return { outcome: 'in-turn', waiting };
    }

    const wokenBy = targets.wokenBy(notice.from);
    const answer = wokenBy.includes(notice.targetId) && targets.wokenBy(notice.targetId).length === 0;

    if (wokenBy.length > 0 && !answer) {
        return { outcome: 'from-message', waiting };
    }

    return { outcome: 'wake', waiting };
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
    return { from: notice.from, title: notice.fromTitle, text: notice.text };
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
