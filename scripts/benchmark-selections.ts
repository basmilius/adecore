import { resolve } from 'node:path';
import * as after from '../packages/editor-core/src/document.ts';
import { measurePairs } from './paired-performance.ts';
import { selectionCases } from './selection-performance-cases.ts';

const baselineRoot = process.argv[2];

if (!baselineRoot) {
    throw new Error('Usage: bun --conditions=source scripts/benchmark-selections.ts <baseline checkout>');
}

const before: typeof after = await import(resolve(baselineRoot, 'packages/editor-core/src/document.ts'));
console.log(JSON.stringify(measurePairs(selectionCases(before, after)), null, 2));
