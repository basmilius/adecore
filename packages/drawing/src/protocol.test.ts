import { describe, expect, test } from 'bun:test';
import {
    EMPTY_DRAWING,
    DrawingColorSchema,
    DrawingFontSchema,
    DrawingDocumentSchema,
    duplicateElementIdIn,
    migrateDrawing,
    type DrawingDocument,
    type DrawingElement
} from './protocol.ts';

const rect: DrawingElement = { kind: 'rect', id: 'el-1', x: 0, y: 0, w: 160, h: 96, stroke: 'ink', strokeWidth: 2, seed: 7 };

const text: DrawingElement = { kind: 'text', id: 'el-2', x: 20, y: 20, w: 80, h: 24, stroke: 'blue', strokeWidth: 1, seed: 3, text: 'hello', size: 20 };

const stroke: DrawingElement = {
    kind: 'freehand',
    id: 'el-3',
    x: 0,
    y: 0,
    w: 10,
    h: 10,
    stroke: 'red',
    strokeWidth: 4,
    seed: 1,
    points: [
        [0, 0, 0.5],
        [10, 10]
    ]
};

describe('the drawing document', () => {
    test('a document with every element kind round-trips', () => {
        const document: DrawingDocument = {
            version: 1,
            rev: 4,
            elements: [
                rect,
                { kind: 'diamond', id: 'el-4', x: 0, y: 0, w: 40, h: 40, stroke: 'ink', strokeWidth: 1, seed: 2 },
                { kind: 'ellipse', id: 'el-5', x: 0, y: 0, w: 40, h: 40, stroke: 'ink', strokeWidth: 1, seed: 2, fill: 'hachure', fillColor: 'yellow' },
                {
                    kind: 'line',
                    id: 'el-6',
                    x: 0,
                    y: 0,
                    w: 100,
                    h: 0,
                    stroke: 'ink',
                    strokeWidth: 2,
                    strokeStyle: 'dashed',
                    seed: 9,
                    points: [
                        [0, 0],
                        [100, 0]
                    ],
                    arrowEnd: true
                },
                stroke,
                text,
                {
                    kind: 'note',
                    id: 'el-7',
                    x: 0,
                    y: 0,
                    w: 180,
                    h: 180,
                    stroke: 'ink',
                    strokeWidth: 1,
                    seed: 5,
                    fill: 'solid',
                    fillColor: 'yellow',
                    text: 'buy milk',
                    size: 20,
                    align: 'center'
                }
            ]
        };
        expect(migrateDrawing(JSON.parse(JSON.stringify(document)))).toEqual(document);
    });

    test('EMPTY_DRAWING parses as a document', () => {
        expect(migrateDrawing(EMPTY_DRAWING)).toEqual(EMPTY_DRAWING);
    });

    test('an absent roughness and font stay absent, so the reader decides what they mean', () => {
        const parsed = migrateDrawing({ version: 1, rev: 0, elements: [rect, text] })!;
        expect(parsed.elements[0]).not.toHaveProperty('roughness');
        expect(parsed.elements[1]).not.toHaveProperty('font');
    });

    test('an unknown element kind, a stray roughness and a stray stroke width are refused', () => {
        expect(migrateDrawing({ version: 1, rev: 0, elements: [{ ...rect, kind: 'star' }] })).toBeNull();
        expect(migrateDrawing({ version: 1, rev: 0, elements: [{ ...rect, roughness: 3 }] })).toBeNull();
        expect(migrateDrawing({ version: 1, rev: 0, elements: [{ ...rect, strokeWidth: 3 }] })).toBeNull();
        expect(migrateDrawing({ version: 1, rev: 0, elements: [{ ...rect, stroke: '#ff0000' }] })).toBeNull();
    });

    test('a version other than 1 and a missing rev are refused', () => {
        expect(migrateDrawing({ version: 2, rev: 0, elements: [] })).toBeNull();
        expect(migrateDrawing({ version: 1, elements: [] })).toBeNull();
    });

    test('a repeated element id is named', () => {
        expect(duplicateElementIdIn([rect, text])).toBeNull();
        expect(duplicateElementIdIn([rect, { ...text, id: rect.id }])).toBe('el-1');
    });
});

test('drawing palette and font order remain stable and parsing adds no defaults', () => {
    expect(DrawingColorSchema.options).toEqual(['ink', 'muted', 'accent', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']);
    expect(DrawingFontSchema.options).toEqual(['hand', 'sans', 'mono']);
    expect(DrawingDocumentSchema.parse({ version: 1, rev: 0, future: true, elements: [{ ...text, future: true }] })).toEqual({
        version: 1,
        rev: 0,
        elements: [text]
    });
    expect(migrateDrawing({ version: 1, rev: -1, elements: [] })).toBeNull();
    expect(migrateDrawing({ version: 1, rev: 0.5, elements: [] })).toBeNull();
    expect(migrateDrawing({ version: 1, rev: 0, elements: [{ ...text, font: 'serif' }] })).toBeNull();
    expect(migrateDrawing({ version: 1, rev: 0, elements: [{ ...text, size: 11 }] })).toBeNull();
    expect(migrateDrawing({ version: 1, rev: 0, elements: [{ ...text, size: 97 }] })).toBeNull();
});
