import { resolve } from 'node:path';
import * as apply from '../packages/plan/src/apply.ts';
import * as permissions from '../packages/plan/src/permissions.ts';
import * as tree from '../packages/plan/src/tree.ts';
import { measurePairs } from './paired-performance';
import { planPermissionCases } from './plan-permission-performance-cases';

const beforeRoot = process.argv[2];

if (!beforeRoot) {
    throw new Error('Usage: bun --conditions=source scripts/benchmark-plan-permissions.ts <before checkout>');
}

const before = {
    ...(await import(resolve(beforeRoot, 'packages/plan/src/tree.ts'))),
    ...(await import(resolve(beforeRoot, 'packages/plan/src/permissions.ts'))),
    ...(await import(resolve(beforeRoot, 'packages/plan/src/apply.ts')))
};
console.log(JSON.stringify(measurePairs(planPermissionCases(before, { ...tree, ...permissions, ...apply })), null, 2));
