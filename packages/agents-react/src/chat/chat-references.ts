import type { ReferenceToken } from './mentions';

/* Another chat a message may point at, under the name it has right now. */
export interface ProjectChat {
    id: string;
    title: string;
}

export type ReferableKind = 'canvas' | 'chat' | 'terminal' | 'note' | 'text' | 'drawing' | 'diagram' | 'browser' | 'device' | 'file' | 'database';

/* What a message may point at with `#`, under the name it has right now. */
export interface Referable {
    id: string;
    name: string;
    kind: ReferableKind;
    /* What tells it apart from another of the same name, such as the canvas it stands on; absent when its kind does. */
    detail?: string;
    /* `canvas` for what stands on the canvas the chat is a node of, `views` for a view of the project. */
    group: 'canvas' | 'views';
}

export interface Referables {
    /* The canvas group first, then the views; never the chat that asks. */
    items: readonly Referable[];
    /* The machine only resolves chats, so nothing else is offered. */
    chatsOnly: boolean;
}

/* What a host without views offers: its chats, which every machine takes. */
export function referablesOfChats(chats: readonly ProjectChat[]): Referables {
    return { items: chats.map((chat) => ({ id: chat.id, name: chat.title, kind: 'chat', group: 'views' })), chatsOnly: true };
}

/*
 * How each id is spelled in a text: under the name it was picked with where `spelled` knows it, else
 * under the name it has now. An id with neither has no token.
 */
export function referenceTokens(ids: readonly string[], items: readonly Referable[], spelled: Readonly<Record<string, string>> = {}): ReferenceToken[] {
    return [...new Set(ids)].flatMap((id) => {
        const name = spelled[id] ?? items.find((item) => item.id === id)?.name;
        return name === undefined || name === '' ? [] : [{ id, name }];
    });
}

/* What a `#query` offers, the canvas first: never an id in `exclude`, and only chats where the machine takes no more. */
export function referenceSuggestions(referables: Referables, query: string, exclude: readonly string[], limit: number): Referable[] {
    const needle = query.toLowerCase();
    const matches = referables.items.filter(
        (item) => item.name !== '' && (!referables.chatsOnly || item.kind === 'chat') && !exclude.includes(item.id) && item.name.toLowerCase().includes(needle)
    );
    return [...matches.filter((item) => item.group === 'canvas'), ...matches.filter((item) => item.group === 'views')].slice(0, limit);
}
