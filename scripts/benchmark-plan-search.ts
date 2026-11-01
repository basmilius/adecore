import { resolve } from 'node:path';
import * as tree from '../packages/plan/src/tree.ts';
import * as apply from '../packages/plan/src/apply.ts';
import { measurePairs } from './paired-performance';
import { planSearchCases } from './plan-search-performance-cases';

const beforeRoot = process.argv[2];

if (!beforeRoot) {
    throw new Error('Usage: bun --conditions=source scripts/benchmark-plan-search.ts <before checkout>');
}

const before = { ...(await import(resolve(beforeRoot, 'packages/plan/src/tree.ts'))), ...(await import(resolve(beforeRoot, 'packages/plan/src/apply.ts'))) };
console.log(JSON.stringify(measurePairs(planSearchCases(before, { ...tree, ...apply })), null, 2));
