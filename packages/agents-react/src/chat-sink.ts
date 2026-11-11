import type { ChatBookmark, ChatEvent, ChatHistoryResult, ChatInfo, ChatItem, ChatSubagentItem, ChatToolItem, ChatVisual } from '@adecore/agent-contracts';
import type { Tolerant } from '@adecore/agent-contracts/tolerance';

/* An item as a client holds it: one of a newer host that this version cannot read stays in its place as `unknown`. */
export type ChatThreadItem = Tolerant<ChatItem>;

export type ChatThreadTurn = Extract<ChatThreadItem, { kind: 'turn' }>;

/* A chat's info as a client holds it: a state word of a newer host is kept as it came. */
export type ChatThreadInfo = Tolerant<ChatInfo>;

/* An event as a client applies it; one of a type this version cannot read changes nothing. */
export type ChatThreadEvent = Tolerant<ChatEvent>;

export type ChatHistoryPage = ChatHistoryResult['history'];

/* The newest part of a thread, as `chat.attach` hands it over with a `historyLimit`. */
export interface ChatPage {
    history: ChatHistoryPage;
    /* Every request of the chat that still waits, wherever in the thread it is. */
    pending: ChatThreadItem[];
    /* The active sub-agents from before the page; absent from a host that sends none. */
    subagents?: Tolerant<ChatSubagentItem>[];
    /* The active Workflow calls from before the page; absent from a host that sends none. */
    workflows?: Tolerant<ChatToolItem>[];
    /* The outline of the thread before the page; absent from a host that sends none. */
    outline?: ChatThreadItem[];
}

/* What a chat client writes. It owns one host's link, so it speaks in chat ids alone. */
export interface ChatSink {
    /*
     * A token held by the cached thread, replaced on reset or eviction. It may change after a write.
     * Without it a client can only retain a replay checkpoint while the chat is mounted.
     */
    historyIdentity?(chatId: string): object | undefined;
    /* Without a page the items are the whole thread. */
    reset(chatId: string, info: ChatThreadInfo, items: ChatThreadItem[], page?: ChatPage): void;
    /* The page before the one the chat holds, read with `cursor`. */
    prepend(chatId: string, cursor: string, page: Tolerant<ChatHistoryResult>): void;
    apply(chatId: string, event: ChatThreadEvent): void;
    /* A reconnect can publish its complete replay at once; absent sinks receive each event through apply. */
    replay?(chatId: string, events: readonly ChatThreadEvent[]): void;
    /* What a chat is doing, for a thread nobody in this window has open. */
    status(chatId: string, info: ChatThreadInfo): void;
    bookmarks(chatId: string, bookmarks: ChatBookmark[]): void;
    visuals(chatId: string, visuals: ChatVisual[]): void;
    forget(chatId: string): void;
}
