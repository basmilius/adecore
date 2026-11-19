import { createContext } from 'react';
import type { HostSkill, OutsideReference } from '../../host/host';
import type { Referable } from '../../host/references';

export interface ReferenceLookup {
    items: readonly Referable[];
    /* Null where the host opens nothing. */
    open: ((id: string) => void) | null;
    /* What an id that is none of `items` still stands for; absent, or null, where it stands for nothing. */
    outside?(id: string): OutsideReference | null;
    /* What a person pointed at with `#` in this thread, which a reply wins over another of the same name. */
    referenced?: readonly string[];
    /* The host's own skills of this chat, whose chips show their title under the host's mark. */
    skills?: readonly HostSkill[];
}

/* What the views, nodes and host skills of a message stand for now, handed down by the row that draws it. */
export const ReferenceLookupContext = createContext<ReferenceLookup>({ items: [], open: null });
