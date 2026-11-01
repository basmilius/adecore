import { resolve } from 'node:path';
import * as after from '../packages/drawing/src/reading-order.ts';
import { drawingCases } from './drawing-performance-cases.ts';
import { measurePairs } from './paired-performance.ts';

const baselineRoot = process.argv[2];

if (!baselineRoot) {
    throw new Error('Usage: bun --conditions=source scripts/benchmark-drawings.ts <baseline checkout>');
}

const before: typeof after = await import(resolve(baselineRoot, 'packages/drawing/src/reading-order.ts'));
console.log(JSON.stringify(measurePairs(drawingCases(before, after)), null, 2));
