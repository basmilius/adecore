import type { ChatBookmark, ChatEvent, ChatHistoryResult, ChatInfo, ChatItem, ChatSubagentItem, ChatToolItem, ChatVisual } from '@adecore/agent-contracts';

export type ChatHistoryPage = ChatHistoryResult['history'];

/* The newest part of a thread, as `chat.attach` hands it over with a `historyLimit`. */
export interface ChatPage {
    history: ChatHistoryPage;
    /* Every request of the chat that still waits, wherever in the thread it is. */
    pending: ChatItem[];
    /* The active sub-agents from before the page; absent from a host that sends none. */
    subagents?: ChatSubagentItem[];
    /* The active Workflow calls from before the page; absent from a host that sends none. */
    workflows?: ChatToolItem[];
    /* The outline of the thread before the page; absent from a host that sends none. */
    outline?: ChatItem[];
}

/* What a chat client writes. It owns one host's link, so it speaks in chat ids alone. */
export interface ChatSink {
    /*
     * A token held by the cached thread, replaced on reset or eviction. It may change after a write.
     * Without it a client can only retain a replay checkpoint while the chat is mounted.
     */
    historyIdentity?(chatId: string): object | undefined;
    /* Without a page the items are the whole thread. */
    reset(chatId: string, info: ChatInfo, items: ChatItem[], page?: ChatPage): void;
    /* The page before the one the chat holds, read with `cursor`. */
    prepend(chatId: string, cursor: string, page: ChatHistoryResult): void;
    apply(chatId: string, event: ChatEvent): void;
    /* A reconnect can publish its complete replay at once; absent sinks receive each event through apply. */
    replay?(chatId: string, events: readonly ChatEvent[]): void;
    /* What a chat is doing, for a thread nobody in this window has open. */
    status(chatId: string, info: ChatInfo): void;
    bookmarks(chatId: string, bookmarks: ChatBookmark[]): void;
    visuals(chatId: string, visuals: ChatVisual[]): void;
    forget(chatId: string): void;
}
