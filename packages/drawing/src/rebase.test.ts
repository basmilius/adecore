import { describe, expect, test } from 'bun:test';
import type { DrawingElement } from './protocol.ts';
import { rebaseDrawingElements } from './rebase.ts';

function rect(id: string, x = 0): DrawingElement {
    return { kind: 'rect', id, x, y: 0, w: 100, h: 50, stroke: 'ink', strokeWidth: 2, seed: 1 };
}

const ids = (elements: readonly DrawingElement[]): string[] => elements.map((element) => element.id);

describe('rebaseDrawingElements', () => {
    const base = [rect('a'), rect('b', 200), rect('c', 400)];

    test('keeps what each side changed, added and removed, when they touched other elements', () => {
        const mine = [rect('a', 50), rect('c', 400), rect('mine', 600)];
        const blue: DrawingElement = { ...rect('c', 400), stroke: 'blue' };
        const theirs = [rect('a'), rect('b', 200), blue, rect('sun', 800)];
        const outcome = rebaseDrawingElements(base, mine, theirs);
        expect(outcome).toEqual({ ok: true, elements: [rect('a', 50), blue, rect('mine', 600), rect('sun', 800)] });
    });

    test('an element both sides changed differently is a conflict, and the same change twice is not', () => {
        expect(rebaseDrawingElements(base, [rect('a', 50), rect('b', 1), rect('c', 400)], [rect('a', 50), rect('b', 2), rect('c', 400)])).toEqual({
            ok: false,
            conflicts: ['b']
        });
        expect(rebaseDrawingElements(base, [rect('a', 50), ...base.slice(1)], [rect('a', 50), ...base.slice(1)])).toEqual({
            ok: true,
            elements: [rect('a', 50), ...base.slice(1)]
        });
    });

    test('one side removing what the other changed is a conflict', () => {
        expect(rebaseDrawingElements(base, [rect('a'), rect('c', 400)], [rect('a'), rect('b', 300), rect('c', 400)])).toEqual({ ok: false, conflicts: ['b'] });
    });

    test('a restack on one side wins, and an element the other side added stays above the one it stood on', () => {
        const mine = [rect('c', 400), rect('a'), rect('b', 200)];
        const theirs = [rect('a'), rect('sun', 800), rect('b', 200), rect('c', 400)];
        const outcome = rebaseDrawingElements(base, mine, theirs);
        expect(outcome.ok && ids(outcome.elements)).toEqual(['c', 'a', 'sun', 'b']);
    });

    test('key order is no change', () => {
        const reordered = Object.fromEntries(Object.entries(rect('b', 200)).reverse()) as DrawingElement;
        const outcome = rebaseDrawingElements(base, [rect('a'), reordered, rect('c', 400)], [rect('a'), rect('b', 300), rect('c', 400)]);
        expect(outcome).toEqual({ ok: true, elements: [rect('a'), rect('b', 300), rect('c', 400)] });
    });
});
