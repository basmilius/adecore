import { describe, expect, test } from 'bun:test';
import { DRAWING_EDIT_LIMITS, DrawingEditSchema, applyDrawingEdit, type DrawingEditMint } from './edits.ts';
import type { DrawingElement } from './protocol.ts';

const rect: DrawingElement = { kind: 'rect', id: 'box', x: 0, y: 0, w: 100, h: 50, stroke: 'blue', strokeWidth: 2, seed: 3 };
const note: DrawingElement = { kind: 'note', id: 'sticky', x: 200, y: 0, w: 120, h: 120, stroke: 'ink', strokeWidth: 1, seed: 4, text: 'Hi', size: 20 };
const locked: DrawingElement = { ...rect, id: 'frame', locked: true };

function counter(): DrawingEditMint {
    let next = 0;

    return { id: () => `new-${++next}`, seed: () => 7 };
}

describe('applyDrawingEdit', () => {
    test('removes, changes in place and adds on top in one step', () => {
        const outcome = applyDrawingEdit(
            [rect, note],
            {
                add: [{ kind: 'ellipse', x: 10, y: 10, w: 40, h: 40, fill: 'solid', fillColor: 'yellow' }],
                update: [{ id: 'sticky', text: 'Bye' }],
                remove: ['box']
            },
            counter()
        );

        expect(outcome).toEqual({
            ok: true,
            added: ['new-1'],
            elements: [
                { ...note, text: 'Bye' },
                { kind: 'ellipse', id: 'new-1', seed: 7, x: 10, y: 10, w: 40, h: 40, stroke: 'ink', strokeWidth: 2, fill: 'solid', fillColor: 'yellow' }
            ]
        });
    });

    test('gives a new text the size a drawing starts with', () => {
        const outcome = applyDrawingEdit([], { add: [{ kind: 'text', x: 0, y: 0, w: 80, h: 30, text: 'Sun' }] }, counter());
        expect(outcome.ok && outcome.elements[0]).toMatchObject({ kind: 'text', size: 20, stroke: 'ink' });
    });

    test('applies nothing when one part is wrong, and says where each problem is', () => {
        const outcome = applyDrawingEdit(
            [rect, note, locked],
            { update: [{ id: 'box', text: 'no' }, { id: 'gone' }, { id: 'frame', x: 4 }], remove: ['box'] },
            counter()
        );

        expect(outcome).toEqual({
            ok: false,
            problems: [
                { path: ['update', 1, 'id'], message: 'the drawing has no element gone' },
                { path: ['update', 2, 'id'], message: 'frame is locked, so an edit leaves it as it is' },
                { path: ['remove', 0], message: 'box is named twice in this edit' },
                { path: ['update', 0, 'text'], message: 'box is a rect, which has no field text' }
            ]
        });
    });

    test('refuses an edit past the limits', () => {
        const many = Array.from({ length: DRAWING_EDIT_LIMITS.perEdit + 1 }, () => 'box');
        expect(applyDrawingEdit([rect], { remove: many }, counter()).ok).toBe(false);
    });

    test('a field no element has and a color off the palette are refused by the schema', () => {
        expect(DrawingEditSchema.safeParse({ add: [{ kind: 'rect', x: 0, y: 0, w: 1, h: 1, stroke: '#ff0000' }] }).success).toBe(false);
        expect(DrawingEditSchema.safeParse({ update: [{ id: 'box', glow: true }] }).success).toBe(false);
        expect(DrawingEditSchema.safeParse({ add: [{ kind: 'rect', x: 0, y: 0, w: 1, h: 1, id: 'mine' }] }).success).toBe(false);
    });
});
