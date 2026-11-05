/* Another chat a message may point at, under the name it has right now. */
export interface ProjectChat {
    id: string;
    title: string;
}

export type ReferableKind =
    | 'project'
    | 'canvas'
    | 'design'
    | 'chat'
    | 'terminal'
    | 'note'
    | 'text'
    | 'drawing'
    | 'diagram'
    | 'browser'
    | 'device'
    | 'file'
    | 'database';

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
    /* What it comes down to in the prompt, for a thing from outside the project that nothing else can read. */
    read?(): Promise<string>;
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
