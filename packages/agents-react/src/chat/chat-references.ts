import type { ReferenceToken } from './mentions';

/* Another chat a message may point at, under the name it has right now. */
export interface ProjectChat {
    id: string;
    title: string;
}

export type ReferableKind = 'project' | 'canvas' | 'chat' | 'terminal' | 'note' | 'text' | 'drawing' | 'diagram' | 'browser' | 'device' | 'file' | 'database';

/* One place on the way to a reference, such as the project or the canvas it stands in. */
export interface ReferenceStep {
    id: string;
    name: string;
    kind: ReferableKind;
}

/* The heading a reference is offered under when a host offers more than one project. */
export interface ReferenceSection {
    id: string;
    name: string;
    /* The project of the chat that asks, which comes first and says so. */
    current?: boolean;
}

/* What a message may point at with `#`, under the name it has right now. */
export interface Referable {
    id: string;
    name: string;
    kind: ReferableKind;
    /* What tells it apart from another of the same name, such as the canvas it stands on; absent when its kind does. */
    detail?: string;
    /* `canvas` for what stands on the canvas the chat is a node of, `views` for a view of the project. */
    group: 'canvas' | 'views';
    /* Where it stands, outermost first; its chip draws these in front of its name. */
    trail?: readonly ReferenceStep[];
    section?: ReferenceSection;
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

    const taken = new Map<string, number>();

    // Per section, or a large first project would keep every other one out of the menu.
    return [...matches.filter((item) => item.group === 'canvas'), ...matches.filter((item) => item.group === 'views')].filter((item) => {
        const section = item.section?.id ?? '';
        const count = taken.get(section) ?? 0;
        taken.set(section, count + 1);

        return count < limit;
    });
}
