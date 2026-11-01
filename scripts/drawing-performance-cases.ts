import type { DrawingElement } from '../packages/drawing/src/protocol.ts';
import type { PerformanceCase } from './paired-performance.ts';

type DrawingApi = Pick<typeof import('../packages/drawing/src/reading-order.ts'), 'readingOrder'>;

export function drawingCases(before: DrawingApi, after: DrawingApi): PerformanceCase[] {
    const cases: PerformanceCase[] = [];
    const base = { stroke: 'ink', strokeWidth: 2, seed: 7 } as const;

    for (const size of [10, 100, 500]) {
        for (const [arrows, shape] of [
            [0, 'chain'],
            [1, 'chain'],
            [Math.floor(size / 2), 'chain'],
            [Math.floor(size / 2), 'star'],
            [Math.floor(size / 2), 'rotated']
        ] as const) {
            const elements: DrawingElement[] = [];

            for (let index = 0; index < size; index++) {
                const x = (index % 20) * 240;
                const y = Math.floor(index / 20) * 160;
                elements.push({ ...base, kind: 'rect', id: `box-${index}`, x, y, w: 100, h: 60, ...(shape === 'rotated' ? { angle: Math.PI / 5 } : {}) });
                elements.push({ ...base, kind: 'text', id: `text-${index}`, x: x + 10, y: y + 20, w: 80, h: 24, text: `Label ${index}`, size: 20 });
            }

            for (let index = 0; index < arrows; index++) {
                const origin = shape === 'star' ? 0 : index;
                const target = (index + 1) % size;
                const x = (origin % 20) * 240 + (shape === 'rotated' ? 50 : 100);
                const y = Math.floor(origin / 20) * 160 + 30;
                const dx = (target % 20) * 240 + (shape === 'rotated' ? 50 : 0) - x;
                const dy = Math.floor(target / 20) * 160 + 30 - y;
                elements.push({
                    ...base,
                    kind: 'line',
                    id: `arrow-${index}`,
                    x,
                    y,
                    w: Math.abs(dx),
                    h: Math.abs(dy),
                    points: [
                        [0, 0],
                        [dx, dy]
                    ],
                    arrowEnd: true
                });
            }

            cases.push({
                name: `readingOrder/${size}/arrows-${arrows}/${shape}`,
                before: () => before.readingOrder(elements),
                after: () => after.readingOrder(elements)
            });
        }
    }

    return cases;
}
