import { describe, expect, test } from 'bun:test';
import {
    DIAGRAM_LIMITS,
    EMPTY_DIAGRAM,
    DiagramShapeSchema,
    DiagramDirectionSchema,
    DiagramDocumentSchema,
    DiagramEdgeStyleSchema,
    diagramProblemIn,
    migrateDiagram,
    type DiagramDocument
} from './protocol.ts';

const example: DiagramDocument = {
    version: 1,
    rev: 7,
    meta: { title: 'System on the wire', direction: 'right' },
    groups: [{ id: 'daemon', label: 'Daemon', wraps: ['sessions', 'projects'], tone: 'muted' }],
    nodes: [
        { id: 'client', label: 'Client', sub: 'React, Vite', tone: 'blue' },
        { id: 'sessions', label: 'SessionManager', sub: 'PTY per node' },
        { id: 'projects', label: 'ProjectStore', sub: '.config/project.json', shape: 'cylinder' },
        { id: 'cli', label: 'Claude Code', shape: 'pill', tone: 'muted' }
    ],
    edges: [
        { from: 'client', to: 'sessions', label: 'session.attach', tone: 'accent' },
        { from: 'sessions', to: 'projects' },
        { from: 'cli', to: 'sessions', label: 'hooks', style: 'dashed' }
    ]
};

describe('the diagram document', () => {
    test('the example from the report round-trips and breaks no rule', () => {
        const parsed = migrateDiagram(JSON.parse(JSON.stringify(example)));
        expect(parsed).toEqual(example);
        expect(diagramProblemIn(parsed!)).toBeNull();
    });

    test('EMPTY_DIAGRAM parses as a document', () => {
        expect(migrateDiagram(EMPTY_DIAGRAM)).toEqual(EMPTY_DIAGRAM);
    });

    test('a node that was dragged keeps its position, and absent fields stay absent', () => {
        const parsed = migrateDiagram({ ...example, nodes: [{ id: 'a', label: 'A', pos: [12, 40] }] })!;
        expect(parsed.nodes[0]).toEqual({ id: 'a', label: 'A', pos: [12, 40] });
        expect(parsed.nodes[0]).not.toHaveProperty('shape');
    });

    test('a hex tone, an unknown shape, a stray direction, a version other than 1 and a missing rev are refused', () => {
        expect(migrateDiagram({ ...example, nodes: [{ id: 'a', label: 'A', tone: '#ff0000' }] })).toBeNull();
        expect(migrateDiagram({ ...example, nodes: [{ id: 'a', label: 'A', shape: 'star' }] })).toBeNull();
        expect(migrateDiagram({ ...example, meta: { title: '', direction: 'left' } })).toBeNull();
        expect(migrateDiagram({ ...example, version: 2 })).toBeNull();
        const { rev: _rev, ...withoutRev } = example;
        expect(migrateDiagram(withoutRev)).toBeNull();
    });

    test('an edge to an unknown id is refused with that id in the message', () => {
        const problem = diagramProblemIn({ ...example, edges: [...example.edges, { from: 'client', to: 'ghost' }] });
        expect(problem).toContain('"ghost"');
    });

    test('a group that wraps an unknown id is refused with that id in the message', () => {
        const problem = diagramProblemIn({ ...example, groups: [{ id: 'daemon', label: 'Daemon', wraps: ['sessions', 'nowhere'] }] });
        expect(problem).toContain('"nowhere"');
    });

    test('a repeated id, a group named like a node and a node in two groups are named', () => {
        expect(diagramProblemIn({ ...example, nodes: [...example.nodes, { id: 'cli', label: 'Again' }] })).toContain('"cli"');
        expect(diagramProblemIn({ ...example, groups: [{ id: 'client', label: 'Client', wraps: [] }] })).toContain('"client"');
        expect(
            diagramProblemIn({
                ...example,
                groups: [...example.groups, { id: 'other', label: 'Other', wraps: ['projects'] }]
            })
        ).toContain('"projects"');
    });
});

describe('the size of a diagram', () => {
    const chain = (nodes: number, edges: number): DiagramDocument => ({
        ...example,
        groups: [],
        nodes: Array.from({ length: nodes }, (_, index) => ({ id: `n${index}`, label: `Node ${index}` })),
        edges: Array.from({ length: edges }, (_, index) => ({ from: `n${index % nodes}`, to: `n${(index + 1) % nodes}` }))
    });

    test('a diagram at the limits is fine', () => {
        expect(diagramProblemIn(chain(DIAGRAM_LIMITS.nodes, DIAGRAM_LIMITS.edges))).toBeNull();
    });

    test('one node or one edge more is refused, saying how many fit', () => {
        expect(diagramProblemIn(chain(DIAGRAM_LIMITS.nodes + 1, 1))).toContain(`at most ${DIAGRAM_LIMITS.nodes} nodes`);
        expect(diagramProblemIn(chain(2, DIAGRAM_LIMITS.edges + 1))).toContain(`at most ${DIAGRAM_LIMITS.edges} edges`);
    });
});

test('diagram enums and optional fields remain stable across schema ownership', () => {
    expect(DiagramShapeSchema.options).toEqual(['rect', 'round', 'pill', 'diamond', 'cylinder']);
    expect(DiagramDirectionSchema.options).toEqual(['right', 'down']);
    expect(DiagramEdgeStyleSchema.options).toEqual(['solid', 'dashed', 'dotted']);
    expect(DiagramDocumentSchema.parse({ ...example, future: true, nodes: [{ id: 'a', label: 'A', future: true }] })).toEqual({
        ...example,
        nodes: [{ id: 'a', label: 'A' }]
    });
    expect(migrateDiagram({ ...example, rev: -1 })).toBeNull();
    expect(migrateDiagram({ ...example, rev: 0.5 })).toBeNull();
});
