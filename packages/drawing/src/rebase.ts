import type { DrawingElement } from './protocol.ts';

export type DrawingRebase = { ok: true; elements: DrawingElement[] } | { ok: false; conflicts: string[] };

/* The same value whatever order its keys were written in, so a document read back from disk equals the one sent. */
function canonical(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(canonical).join(',')}]`;
    }
    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, entry]) => entry !== undefined)
            .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
        return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function byId(elements: readonly DrawingElement[]): Map<string, { element: DrawingElement; text: string }> {
    return new Map(elements.map((element) => [element.id, { element, text: canonical(element) }]));
}

/* Whether a side stacked the elements it shares with the base in another order. */
function restacked(base: readonly DrawingElement[], side: readonly DrawingElement[]): boolean {
    const shared = new Set(base.map((element) => element.id));
    const order = side.map((element) => element.id).filter((id) => shared.has(id));
    const inSide = new Set(order);
    const before = base.map((element) => element.id).filter((id) => inSide.has(id));
    return order.some((id, i) => id !== before[i]);
}

/*
 * Puts the elements `mine` changed since `base` onto `theirs`, by id. Only an element both sides
 * changed, each in its own way, is a conflict; an element added, changed or removed on one side only
 * merges. The stacking order is the one a side changed, `theirs` when neither or both did, and an
 * element only the other side added goes in just above the element it stood on there.
 */
export function rebaseDrawingElements(base: readonly DrawingElement[], mine: readonly DrawingElement[], theirs: readonly DrawingElement[]): DrawingRebase {
    const baseById = byId(base);
    const mineById = byId(mine);
    const theirsById = byId(theirs);
    const ids = new Set([...baseById.keys(), ...mineById.keys(), ...theirsById.keys()]);
    const resolved = new Map<string, DrawingElement>();
    const conflicts: string[] = [];
    for (const id of ids) {
        const original = baseById.get(id)?.text;
        const ours = mineById.get(id);
        const their = theirsById.get(id);
        const oursChanged = ours?.text !== original;
        const theirsChanged = their?.text !== original;
        if (oursChanged && theirsChanged && ours?.text !== their?.text) {
            conflicts.push(id);
            continue;
        }
        const kept = oursChanged ? ours : their;
        if (kept !== undefined) {
            resolved.set(id, kept.element);
        }
    }
    if (conflicts.length > 0) {
        return { ok: false, conflicts };
    }
    const mineLeads = restacked(base, mine) && !restacked(base, theirs);
    const [leading, following] = mineLeads ? [mine, theirs] : [theirs, mine];
    const order = leading.map((element) => element.id).filter((id) => resolved.has(id));
    const placed = new Set(order);
    following.forEach((element, i) => {
        if (placed.has(element.id) || !resolved.has(element.id)) {
            return;
        }
        const below = following
            .slice(0, i)
            .map((candidate) => candidate.id)
            .findLast((id) => placed.has(id));
        order.splice(below === undefined ? 0 : order.indexOf(below) + 1, 0, element.id);
        placed.add(element.id);
    });
    return { ok: true, elements: order.flatMap((id) => resolved.get(id) ?? []) };
}
