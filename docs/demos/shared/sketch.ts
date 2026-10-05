import type { DrawingElement } from '@adecore/drawing/protocol';

/* Three shapes joined by arrows, a label in each, an underline and a note, back to front. */
export const SKETCH: DrawingElement[] = [
    { kind: 'rect', id: 'idea', x: 0, y: 0, w: 140, h: 80, stroke: 'blue', strokeWidth: 2, fill: 'hachure', seed: 11 },
    { kind: 'diamond', id: 'review', x: 250, y: -20, w: 140, h: 120, stroke: 'orange', strokeWidth: 2, seed: 12 },
    { kind: 'ellipse', id: 'shipped', x: 500, y: 0, w: 150, h: 80, stroke: 'green', strokeWidth: 2, seed: 13 },
    {
        kind: 'line',
        id: 'to-review',
        x: 137,
        y: 40,
        w: 117,
        h: 0,
        stroke: 'ink',
        strokeWidth: 2,
        seed: 14,
        points: [
            [0, 0],
            [117, 0]
        ],
        arrowEnd: true
    },
    {
        kind: 'line',
        id: 'to-shipped',
        x: 386,
        y: 40,
        w: 117,
        h: 0,
        stroke: 'ink',
        strokeWidth: 2,
        seed: 15,
        points: [
            [0, 0],
            [117, 0]
        ],
        arrowEnd: true
    },
    { kind: 'text', id: 'idea-label', x: 48, y: 27, w: 44, h: 25, stroke: 'ink', strokeWidth: 1, seed: 16, text: 'Idea', size: 20 },
    { kind: 'text', id: 'review-label', x: 287, y: 28, w: 66, h: 25, stroke: 'ink', strokeWidth: 1, seed: 17, text: 'Review', size: 20 },
    { kind: 'text', id: 'shipped-label', x: 537, y: 27, w: 77, h: 25, stroke: 'ink', strokeWidth: 1, seed: 18, text: 'Shipped', size: 20 },
    {
        kind: 'freehand',
        id: 'underline',
        x: 525,
        y: 92,
        w: 100,
        h: 6,
        stroke: 'accent',
        strokeWidth: 2,
        seed: 19,
        points: [
            [0, 4],
            [20, 0],
            [40, 6],
            [60, 1],
            [80, 5],
            [100, 2]
        ]
    },
    {
        kind: 'note',
        id: 'note',
        x: 230,
        y: 130,
        w: 200,
        h: 100,
        stroke: 'ink',
        strokeWidth: 1,
        seed: 20,
        fillColor: 'yellow',
        text: 'Ask for a second review when the change touches billing',
        size: 16
    }
];
