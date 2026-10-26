import { useContext } from 'react';
import { create } from 'zustand';
import type {
    AgentKind,
    ChatApprovalItem,
    ChatBookmark,
    ChatEvent,
    ChatHistoryResult,
    ChatInfo,
    ChatItem,
    ChatQuestionItem,
    ChatSubagentItem,
    ChatVisual
} from '@adecore/agent-contracts';
import { appendToolOutput } from '@adecore/agent-contracts/text';
import { ChatScopeContext, useChatScope } from '../scope';

export interface ChatState {
    info: ChatInfo;
    /* Status and live events do not establish where the initial history begins. */
    historyPending?: boolean;
    items: Record<string, ChatItem>;
    /*
     * `items`, except that a delta growing a reply or thought that has text, or a running call's output,
     * leaves it as it was. The rows derive from this, so a word redraws only its row (`useCurrentItem`).
     */
    structure: Record<string, ChatItem>;
    order: string[];
    /* Where the part of the thread this client holds begins; absent when it holds the whole thread. */
    history?: ChatHistoryPage;
    /*
     * Requests from before that part that still wait, oldest first. They are in `items` and
     * `structure` but not in `order`, since the thread on screen does not reach back to them yet.
     */
    waitingBefore?: string[];
    /*
     * Sub-agents from before that part, held the same way, so the pill over the composer knows of one
     * that a message woke again without a scroll reaching back to its row.
     */
    subagentsBefore?: string[];
    /* The messages marked to come back to, as the host last said; absent until it said anything. */
    bookmarks?: ChatBookmark[];
    /* The pages agents published in the chat, as the host last said; absent until it said anything. */
    visuals?: ChatVisual[];
}

export type ChatHistoryPage = ChatHistoryResult['history'];

/* The newest part of a thread, as `chat.attach` hands it over with a `historyLimit`. */
export interface ChatPage {
    history: ChatHistoryPage;
    /* Every request of the chat that still waits, wherever in the thread it is. */
    pending: ChatItem[];
    /* The active sub-agents from before the page; absent from a host that sends none. */
    subagents?: ChatSubagentItem[];
}

/* Rows keyed with the scope's `keyOf`, so a thread says which host it runs on. */
export type ChatsById = Record<string, ChatState>;

/* What a chat is doing, without its thread. */
export type ChatStatuses = Record<string, Pick<ChatState, 'info'>>;

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

interface ChatsStore {
    byKey: ChatsById;
    /* Replaced only when a chat's info is, never for a streamed word, so what reads the status alone is not redrawn by one. */
    statusByKey: ChatStatuses;
    reset(key: string, info: ChatInfo, items: ChatItem[], page?: ChatPage): void;
    prepend(key: string, cursor: string, page: ChatHistoryResult): void;
    apply(key: string, event: ChatEvent): void;
    replay(key: string, events: readonly ChatEvent[]): void;
    status(key: string, info: ChatInfo): void;
    bookmarks(key: string, bookmarks: ChatBookmark[]): void;
    visuals(key: string, visuals: ChatVisual[]): void;
    forget(key: string): void;
    /* Drops the threads whose key matches, such as every thread of one host. They keep running there; this client is done looking at them. */
    forgetWhere(matches: (key: string) => boolean): void;
}

function isWaiting(item: ChatItem | undefined): item is ChatApprovalItem | ChatQuestionItem {
    return (item?.kind === 'approval' && item.decision === 'pending') || (item?.kind === 'question' && item.state === 'pending');
}

function stateOf(info: ChatInfo, items: ChatItem[], page?: ChatPage): ChatState {
    const byId = Object.fromEntries(items.map((item) => [item.id, item]));
    const order = items.map((item) => item.id);
    if (page === undefined || page.history.cursor === null) {
        return { info, items: byId, structure: byId, order };
    }
    const before = page.pending.filter((item) => !(item.id in byId));
    const subagents = (page.subagents ?? []).filter((item) => !(item.id in byId));
    for (const item of [...before, ...subagents]) {
        byId[item.id] = item;
    }
    return {
        info,
        items: byId,
        structure: byId,
        order,
        history: page.history,
        waitingBefore: before.map((item) => item.id),
        subagentsBefore: subagents.map((item) => item.id)
    };
}

/* An older host names no place in the thread, and it always hands over the whole of it. */
function isBeforePage(state: ChatState, historyIndex: number | undefined): boolean {
    return state.history !== undefined && historyIndex !== undefined && historyIndex < state.history.start;
}

type ItemWriter = (state: ChatState, item: ChatItem, structural?: boolean) => ChatState;

/* An item from before the page this client holds matters only as a sub-agent, a request that waits, or one that stopped waiting. */
function withEarlierItem(state: ChatState, item: ChatItem, write: ItemWriter): ChatState {
    if (item.kind === 'subagent') {
        const subagents = state.subagentsBefore ?? [];
        return { ...write(state, item), subagentsBefore: subagents.includes(item.id) ? subagents : [...subagents, item.id] };
    }
    const waiting = state.waitingBefore ?? [];
    const held = waiting.includes(item.id);
    if (isWaiting(item)) {
        return { ...write(state, item), waitingBefore: held ? waiting : [...waiting, item.id] };
    }
    return held ? { ...write(state, item), waitingBefore: waiting.filter((id) => id !== item.id) } : state;
}

/* The page before the one a chat holds, unless the thread was read again since that page was asked for. */
export function prependPage(state: ChatState, cursor: string, page: ChatHistoryResult): ChatState {
    if (state.history?.cursor !== cursor) {
        return state;
    }
    const { historyPending: _historyPending, ...loaded } = state;
    const held = new Set(state.order);
    const older = page.items.filter((item) => !held.has(item.id));
    const olderIds = new Set(older.map((item) => item.id));
    const items = { ...state.items };
    for (const item of older) {
        // A request from before the page that this client already holds came in live, which is never older than the page.
        items[item.id] = state.items[item.id] ?? item;
    }
    const order = [...olderIds, ...state.order];
    if (page.history.cursor === null) {
        const { history: _history, waitingBefore: _waitingBefore, subagentsBefore: _subagentsBefore, ...rest } = loaded;
        return { ...rest, items, structure: items, order };
    }
    const waitingBefore = (state.waitingBefore ?? []).filter((id) => !olderIds.has(id));
    const subagentsBefore = (state.subagentsBefore ?? []).filter((id) => !olderIds.has(id));
    return { ...loaded, items, structure: items, order, history: page.history, waitingBefore, subagentsBefore };
}

/* The requests that still wait, oldest first: those from before the page this client holds, then the thread's own. */
export function waitingRequestsOf(chat: Pick<ChatState, 'structure' | 'order' | 'waitingBefore'> | undefined): Array<ChatApprovalItem | ChatQuestionItem> {
    return [...(chat?.waitingBefore ?? []), ...(chat?.order ?? [])].map((id) => chat?.structure[id]).filter(isWaiting);
}

function withItem(state: ChatState, item: ChatItem, structural = true): ChatState {
    const items = { ...state.items, [item.id]: item };
    return structural ? { ...state, items, structure: items } : { ...state, items };
}

/* Cheap enough, since a status only arrives when the host saw one change, never on a streamed word. */
function sameInfo(left: ChatInfo, right: ChatInfo): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

/* The statuses with this chat's info in them, the same object when that info is already there. */
function withStatus(statuses: ChatStatuses, key: string, info: ChatInfo): ChatStatuses {
    return statuses[key]?.info === info ? statuses : { ...statuses, [key]: { info } };
}

function without<T>(rows: Record<string, T>, matches: (key: string) => boolean): Record<string, T> {
    return Object.fromEntries(Object.entries(rows).filter(([key]) => !matches(key)));
}

export function applyEvent(state: ChatState, event: ChatEvent): ChatState {
    return applyUpdate(state, event, withItem);
}

function replayEvents(state: ChatState, events: readonly ChatEvent[]): ChatState {
    let draft: Record<string, ChatItem> | undefined;
    const write: ItemWriter = (current, item, structural = true) => {
        // A text delta must leave the last structural snapshot intact, including within this replay.
        if (draft !== current.items || (!structural && draft === current.structure)) {
            draft = { ...current.items };
        }
        // Item ids may be __proto__, so this must define an own data property.
        Object.defineProperty(draft, item.id, { value: item, enumerable: true, configurable: true, writable: true });
        return structural ? { ...current, items: draft, structure: draft } : { ...current, items: draft };
    };
    for (const event of events) {
        state = applyUpdate(state, event, write);
    }
    return state;
}

function applyUpdate(state: ChatState, event: ChatEvent, write: ItemWriter): ChatState {
    switch (event.type) {
        case 'item': {
            if (isBeforePage(state, event.historyIndex)) {
                return withEarlierItem(state, event.item, write);
            }
            const known = event.item.id in state.items;
            return { ...write(state, event.item), order: known ? state.order : [...state.order, event.item.id] };
        }
        case 'delta': {
            const item = state.items[event.itemId];
            if (event.uiQueries && item?.kind === 'assistant') {
                // The text first, as the daemon's thread applies it, then the metadata on what it grew into.
                const { uiQueries, ...text } = event;
                const grown = event.text === '' ? state : applyUpdate(state, text, write);
                const reply = grown.items[event.itemId] ?? item;
                return write(grown, { ...reply, uiQueries } as ChatItem, false);
            }
            if (event.ui !== undefined && event.text === '') {
                if (item?.kind === 'assistant' && item.streaming && event.textLength === item.text.length) {
                    return write(state, { ...item, ui: event.ui }, false);
                }
                return state;
            }
            if (item?.kind === 'assistant' || item?.kind === 'thinking') {
                const grown = { ...item, text: item.text + event.text };
                // The first text is structure after all, since an empty reply that is not streaming has no row.
                return write(state, grown, item.text === '');
            }
            if (item?.kind === 'tool' && item.state === 'running') {
                const progress = item.progress ?? { startedAt: null, description: null, output: null };
                return write(state, { ...item, progress: { ...progress, output: appendToolOutput(progress.output, event.text) } }, false);
            }
            return state;
        }
        case 'info':
            return { ...state, info: event.info };
        case 'reset':
            return stateOf(event.info, event.items);
    }
}

/* Fields of a held chat that are not part of its thread; a chat this client does not hold stays as it is. */
function withFields(store: ChatsStore, key: string, fields: Pick<ChatState, 'bookmarks' | 'visuals'>): Partial<ChatsStore> {
    const current = store.byKey[key];
    if (!current) {
        return {};
    }
    return { byKey: { ...store.byKey, [key]: { ...current, ...fields } } };
}

export const useChats = create<ChatsStore>((set) => ({
    byKey: {},
    statusByKey: {},
    reset(key, info, items, page) {
        set((s) => {
            // The bookmarks and the visuals are not part of the thread; they come in on their own and outlive a reset of it.
            const { bookmarks, visuals } = s.byKey[key] ?? {};
            const next = { ...stateOf(info, items, page), ...(bookmarks === undefined ? {} : { bookmarks }), ...(visuals === undefined ? {} : { visuals }) };
            return {
                byKey: { ...s.byKey, [key]: next },
                statusByKey: withStatus(s.statusByKey, key, info)
            };
        });
    },
    prepend(key, cursor, page) {
        set((s) => {
            const current = s.byKey[key];
            if (!current) {
                return {};
            }
            const next = prependPage(current, cursor, page);
            return next === current ? {} : { byKey: { ...s.byKey, [key]: next } };
        });
    },
    apply(key, event) {
        set((s) => {
            const current = s.byKey[key];
            if (!current) {
                return {};
            }
            const next = applyEvent(current, event);
            return { byKey: { ...s.byKey, [key]: next }, statusByKey: withStatus(s.statusByKey, key, next.info) };
        });
    },
    replay(key, events) {
        set((store) => {
            const current = store.byKey[key];
            if (!current || events.length === 0) {
                return store;
            }
            const next = replayEvents(current, events);
            return next === current ? store : { byKey: { ...store.byKey, [key]: next }, statusByKey: withStatus(store.statusByKey, key, next.info) };
        });
    },
    /*
     * The host sends this for every chat it has loaded. The thread stays empty until somebody attaches,
     * since a header, a list and the counters read the info and never the items.
     */
    status(key, info) {
        set((s) => {
            const current = s.byKey[key];
            if (!current) {
                return { byKey: { ...s.byKey, [key]: { ...stateOf(info, []), historyPending: true } }, statusByKey: withStatus(s.statusByKey, key, info) };
            }
            // An attached client already had this on `chat.event`; writing it again would redraw the thread.
            if (sameInfo(current.info, info)) {
                return {};
            }
            return { byKey: { ...s.byKey, [key]: { ...current, info } }, statusByKey: withStatus(s.statusByKey, key, info) };
        });
    },
    bookmarks(key, bookmarks) {
        set((s) => withFields(s, key, { bookmarks }));
    },
    visuals(key, visuals) {
        set((s) => withFields(s, key, { visuals }));
    },
    forget(key) {
        set((s) => {
            const next = { ...s.byKey };
            delete next[key];
            const statuses = { ...s.statusByKey };
            delete statuses[key];
            return { byKey: next, statusByKey: statuses };
        });
    },
    forgetWhere(matches) {
        set((s) => ({ byKey: without(s.byKey, matches), statusByKey: without(s.statusByKey, matches) }));
    }
}));

/* The sink of one host's chat client: it hands over chat ids, this puts them under the keys of its scope. */
export function chatSink(keyOf: (chatId: string) => string): ChatSink {
    return {
        historyIdentity: (chatId) => useChats.getState().byKey[keyOf(chatId)]?.order,
        reset: (chatId, info, items, page) => useChats.getState().reset(keyOf(chatId), info, items, page),
        prepend: (chatId, cursor, page) => useChats.getState().prepend(keyOf(chatId), cursor, page),
        apply: (chatId, event) => useChats.getState().apply(keyOf(chatId), event),
        replay: (chatId, events) => useChats.getState().replay(keyOf(chatId), events),
        status: (chatId, info) => useChats.getState().status(keyOf(chatId), info),
        bookmarks: (chatId, bookmarks) => useChats.getState().bookmarks(keyOf(chatId), bookmarks),
        visuals: (chatId, visuals) => useChats.getState().visuals(keyOf(chatId), visuals),
        forget: (chatId) => useChats.getState().forget(keyOf(chatId))
    };
}

/* One chat's thread in the scope this is rendered in. The selector keeps a render tied to the field it reads. */
export function useChatRow<T>(chatId: string, select: (row: ChatState | undefined) => T): T {
    const { keyOf } = useChatScope();
    return useChats((s) => select(s.byKey[keyOf(chatId)]));
}

/*
 * The models the CLI of this provider reported running in the chats this client holds of the host.
 * A model it ran is proof the CLI offers it, whatever the version says. Outside a scope there is none.
 */
export function useReportedModels(provider: AgentKind): ReadonlySet<string> {
    const scope = useContext(ChatScopeContext);
    const joined = useChats((s) => {
        const names = new Set<string>();
        for (const [key, state] of Object.entries(s.statusByKey)) {
            if (scope?.owns(key) === true && state.info.provider === provider && state.info.model !== null) {
                names.add(state.info.model);
            }
        }
        return [...names].sort().join('\n');
    });
    return new Set(joined === '' ? [] : joined.split('\n'));
}

/* Whether a call still waits on the person's answer to an approval of it, when its clock is not running yet. */
export function useAwaitsApproval(chatId: string, toolUseId: string): boolean {
    return useChatRow(chatId, (row) => waitingRequestsOf(row).some((request) => request.kind === 'approval' && request.toolUseId === toolUseId));
}

/* The item as the thread holds it now, for a row derived from the structure, which a delta leaves alone. */
export function useCurrentItem<T extends ChatItem>(chatId: string, derived: T): T {
    return useChatRow(chatId, (row) => {
        const item = row?.items[derived.id];
        return item?.kind === derived.kind ? (item as T) : derived;
    });
}
