import { describe, expect, test } from 'bun:test';
import { pathsOfElement } from './paths.ts';
import { EMPTY_DRAWING, type DrawingDocument, type DrawingElement } from './protocol.ts';
import { drawingScene } from './scene.ts';
import { toSvg } from './svg.ts';

const base = { x: 40, y: 60, w: 160, h: 80, stroke: 'blue' as const, strokeWidth: 2 as const, seed: 28 };

function drawing(elements: DrawingElement[]): DrawingDocument {
    return { version: 1, rev: 9, elements };
}

describe('drawingScene', () => {
    test('an empty file is a finite empty scene', () => {
        expect(drawingScene(EMPTY_DRAWING)).toEqual({ rev: 0, bounds: { x: 0, y: 0, w: 0, h: 0 }, elements: [] });
    });

    test('rough paths keep their exact seeds and hachures remain strokes', () => {
        const element: DrawingElement = { ...base, id: 'rough', kind: 'ellipse', fill: 'hachure', fillColor: 'green' };
        const scene = drawingScene(drawing([element]));

        expect(scene.elements[0]?.paths.map((path) => path.d)).toEqual(pathsOfElement(element).map((path) => path.d));
        expect(drawingScene(drawing([element]))).toEqual(scene);
        expect(scene.elements[0]?.paths.some((path) => path.stroke?.tone === 'green' && path.fill === null)).toBe(true);
    });

    test('notes carry their paper, edge, wrapped text and local rotation center', () => {
        const scene = drawingScene(
            drawing([
                {
                    ...base,
                    id: 'note',
                    kind: 'note',
                    text: 'A sticky note with several words',
                    size: 20,
                    fillColor: 'yellow',
                    angle: Math.PI / 2,
                    align: 'center'
                }
            ])
        );
        const note = scene.elements[0]!;

        expect(note).toMatchObject({ x: 40, y: 60, centerX: 80, centerY: 40, angle: Math.PI / 2 });
        expect(note.paths.some((path) => path.fill?.palette === 'paper' && path.fill.tone === 'yellow')).toBe(true);
        expect(note.paths.some((path) => path.stroke?.palette === 'edge' && path.stroke.tone === 'yellow')).toBe(true);
        expect(note.text.length).toBeGreaterThan(1);
        expect(note.text[0]).toMatchObject({ x: 80, y: 36, align: 'center', font: 'hand', color: { tone: 'blue', palette: 'ink' } });
        expect(scene.bounds.x).toBeCloseTo(80);
        expect(scene.bounds.y).toBeCloseTo(20);
        expect(scene.bounds.w).toBeCloseTo(80);
        expect(scene.bounds.h).toBeCloseTo(160);
    });

    test('freehand ink is filled and text elements contain no shape', () => {
        const scene = drawingScene(
            drawing([
                {
                    ...base,
                    id: 'pen',
                    kind: 'freehand',
                    points: [
                        [0, 0, 0.2],
                        [20, 15, 0.8],
                        [50, 0, 0.5]
                    ]
                },
                { ...base, id: 'text', kind: 'text', text: '<hello>\nworld', size: 24, font: 'mono', align: 'right' }
            ])
        );

        expect(scene.elements[0]?.paths[0]).toMatchObject({ stroke: null, fill: { tone: 'blue', palette: 'ink' } });
        expect(scene.elements[1]?.paths).toEqual([]);
        expect(scene.elements[1]?.text.map((line) => line.text)).toEqual(['<hello>', 'world']);
        expect(scene.elements[1]?.text[0]).toMatchObject({ align: 'right', x: 160, font: 'mono' });
    });

    test('a line sits where the SVG puts it', () => {
        const element: DrawingElement = { ...base, id: 'text', kind: 'text', text: 'one\ntwo', size: 24, align: 'center' };
        const lines = drawingScene(drawing([element])).elements[0]!.text;
        const tspans = [...toSvg([element]).matchAll(/<tspan x="([\d.-]+)" y="([\d.-]+)"/g)].map((match) => [Number(match[1]), Number(match[2])]);

        expect(lines.map((line) => [Math.round(line.x * 100) / 100, Math.round(line.y * 100) / 100])).toEqual(tspans);
    });
});
