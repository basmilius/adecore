import { describe, expect, test } from 'bun:test';
import { layoutOf } from './layout.ts';
import { EMPTY_DIAGRAM, type DiagramDocument } from './protocol.ts';
import { diagramScene } from './scene.ts';
import { shapePaths, textLinesOf } from './shapes.ts';
import { toSvg } from './svg.ts';

const document: DiagramDocument = {
    version: 1,
    rev: 4,
    meta: { title: 'Flow', direction: 'right' },
    nodes: [
        { id: 'a', label: 'Database', shape: 'cylinder', tone: 'blue', sub: 'Store' },
        { id: 'b', label: 'Client', shape: 'pill' }
    ],
    groups: [{ id: 'group', label: 'System', wraps: ['a', 'b'], tone: 'purple' }],
    edges: [{ from: 'a', to: 'b', label: 'Reads', style: 'dashed', tone: 'orange' }]
};

describe('diagramScene', () => {
    test('an empty file is a finite empty scene', () => {
        expect(diagramScene(EMPTY_DIAGRAM)).toEqual({ rev: 0, bounds: { x: 0, y: 0, w: 0, h: 0 }, elements: [] });
    });

    test('shapes and label positions come from the shared layout', () => {
        const scene = diagramScene(document);
        const layout = layoutOf(document);

        expect(scene.rev).toBe(4);
        expect(scene.bounds).toEqual(layout.bounds);
        expect(scene.elements.map((element) => element.id)).toEqual(['group:group', 'edge:0', 'node:a', 'node:b']);

        const database = scene.elements[2]!;
        const shape = shapePaths('cylinder', layout.nodes[0]!);

        expect(database.paths.map((path) => path.d)).toEqual([shape.body, shape.detail!]);
        expect(database.paths[0]?.fill).toEqual({ tone: 'blue', palette: 'paper' });
        expect(database.paths[1]?.fill).toBeNull();
        expect(database.text.map(({ text, x, y }) => ({ text, x, y }))).toEqual(
            textLinesOf(layout.nodes[0]!, 'cylinder').map(({ text, x, y }) => ({ text, x, y }))
        );
        expect(database.text[1]?.color).toEqual({ tone: 'muted', palette: 'ink' });
        expect(scene.elements[1]?.paths[0]?.dash).toEqual([8, 6]);
        expect(JSON.stringify(scene)).not.toContain('#');
    });

    test('a group is outlined with the dash and label baseline of the SVG', () => {
        const group = diagramScene(document).elements[0]!;
        const svg = toSvg(document);
        const label = /<text x="([\d.-]+)" y="([\d.-]+)"[^>]*font-weight="600"/.exec(svg)!;

        expect(group.paths[0]).toMatchObject({ strokeWidth: 1, dash: [6, 4], fill: null, stroke: { tone: 'purple', palette: 'ink' } });
        expect(svg).toContain('stroke-width="1" stroke-dasharray="6 4"');
        expect(group.text[0]).toMatchObject({ x: Number(label[1]), y: Number(label[2]), bold: true, align: 'left' });
    });
});
