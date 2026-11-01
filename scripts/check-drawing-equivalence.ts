import { deepStrictEqual } from 'node:assert';
import { resolve } from 'node:path';
import type { DrawingElement } from '../packages/drawing/src/protocol.ts';
import * as after from '../packages/drawing/src/reading-order.ts';

const baselineRoot = process.argv[2];

if (!baselineRoot) {
    throw new Error('Usage: bun --conditions=source scripts/check-drawing-equivalence.ts <baseline checkout>');
}

const before: typeof after = await import(resolve(baselineRoot, 'packages/drawing/src/reading-order.ts'));
const angles = [undefined, 0, -0, Math.PI / 2, Math.PI / 5, -Math.PI / 3];
let seed = 20261102;

function random(limit: number): number {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

    return seed % limit;
}

for (let sample = 0; sample < 5000; sample++) {
    const unit = sample % 3 === 0 ? 0.25 : 1;
    const elements: DrawingElement[] = Array.from({ length: random(60) }, (_, index): DrawingElement => {
        const base = {
            id: `element-${sample % 11 === 0 ? index % 3 : index}`,
            x: (random(1000) - 500) * unit,
            y: (random(1000) - 500) * unit,
            w: (random(400) - (sample % 7 === 0 ? 50 : 0)) * unit,
            h: (random(400) - (sample % 7 === 0 ? 50 : 0)) * unit,
            stroke: 'ink' as const,
            strokeWidth: 2 as const,
            seed: index,
            angle: angles[random(angles.length)]
        };
        const kind = sample % 10 === 0 ? 3 : random(7);

        if (kind < 3) {
            return { ...base, kind: kind === 0 ? 'rect' : kind === 1 ? 'diamond' : 'ellipse' };
        }

        if (kind < 5) {
            return { ...base, kind: kind === 3 ? 'text' : 'note', text: ['', '  ', 'éclair', `Label ${index}`][random(4)]!, size: 20 };
        }

        if (kind === 5) {
            return {
                ...base,
                kind: 'line',
                points: [
                    [0, 0],
                    [base.w, base.h]
                ],
                arrowStart: random(2) === 0,
                arrowEnd: random(2) === 0
            };
        }

        return {
            ...base,
            kind: 'freehand',
            points: [
                [0, 0],
                [base.w, base.h, 0.5]
            ]
        };
    });

    for (let index = elements.length - 1; index > 0; index--) {
        const other = random(index + 1);
        [elements[index], elements[other]] = [elements[other]!, elements[index]!];
    }

    const snapshot = structuredClone(elements);
    deepStrictEqual(after.readingOrder(elements), before.readingOrder(elements), `readingOrder ${sample}`);
    deepStrictEqual(elements, snapshot, `input unchanged ${sample}`);
}

console.log(JSON.stringify({ seed: 20261102, samples: 5000, comparisons: 10000, result: 'identical' }));
