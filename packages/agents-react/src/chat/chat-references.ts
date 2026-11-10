import type { Referable, Referables } from '../host/references';
import type { ReferenceToken } from './mentions';

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

    // A name on the way counts as well, so typing a project or a canvas finds what stands in it.
    const found = referables.items.filter(
        (item) =>
            item.name !== '' &&
            (!referables.chatsOnly || item.kind === 'chat') &&
            !exclude.includes(item.id) &&
            [item.name, ...(item.trail ?? []).map((step) => step.name)].some((name) => name.toLowerCase().includes(needle))
    );

    // A node never stands in the menu without its canvas above it, even a canvas that does not match or is picked.
    const canvases = new Set(found.flatMap((item) => item.trail?.filter((step) => step.kind === 'canvas').map((step) => step.id) ?? []));
    const matches = referables.items.filter((item) => found.includes(item) || canvases.has(item.id));

    const taken = new Map<string, number>();

    // Per section, or a large first project would keep every other one out of the menu.
    return [...matches.filter((item) => item.group === 'canvas'), ...matches.filter((item) => item.group === 'views')].filter((item) => {
        const section = item.section?.id ?? '';
        const count = taken.get(section) ?? 0;
        taken.set(section, count + 1);

        return count < limit;
    });
}
