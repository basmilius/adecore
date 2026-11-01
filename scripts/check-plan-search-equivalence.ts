import { deepStrictEqual, strictEqual } from 'node:assert';
import { resolve } from 'node:path';
import type { PlanItem, PlanStep } from '../packages/plan/src/protocol.ts';
import * as after from '../packages/plan/src/tree.ts';

const beforeRoot = process.argv[2];

if (!beforeRoot) {
    throw new Error('Usage: bun --conditions=source scripts/check-plan-search-equivalence.ts <before checkout>');
}

const before: typeof after = await import(resolve(beforeRoot, 'packages/plan/src/tree.ts'));
let seed = 20261103;

function random(limit: number): number {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

    return (seed >>> 8) % limit;
}

for (let sample = 0; sample < 1000; sample++) {
    let next = 0;
    const ids: string[] = [];
    const id = (): string => {
        const value = `item-${sample % 7 === 0 ? next % 5 : next}`;
        next++;
        ids.push(value);

        return value;
    };
    const step = (depth: number): PlanStep => {
        const result: PlanStep = { type: 'step', id: id(), title: 'Step' };

        if (depth < 3 && next < 100 && random(3) === 0) {
            result.steps = Array.from({ length: random(4) }, () => step(depth + 1));
        } else if (random(3) === 0) {
            result.steps = [];
        }

        return result;
    };
    const items: PlanItem[] = Array.from({ length: random(20) }, (_, index): PlanItem => {
        if (index % 4 === 0) {
            return { type: 'text', id: id(), title: 'Text' };
        }

        if (index % 4 === 1) {
            return { type: 'section', id: id(), title: 'Section', items: Array.from({ length: random(5) }, () => step(1)) };
        }

        return step(1);
    });
    const plan = { items };
    const saved = structuredClone(plan);

    for (const target of [ids[0], ids[Math.floor(ids.length / 2)], ids.at(-1), 'missing']) {
        const original = before.locateItem(plan, target ?? 'missing');
        const changed = after.locateItem(plan, target ?? 'missing');
        deepStrictEqual(changed, original, `location ${sample}/${target}`);
        strictEqual(changed?.item, original?.item, `item reference ${sample}/${target}`);
        strictEqual(changed?.siblings, original?.siblings, `siblings reference ${sample}/${target}`);
        strictEqual(changed?.parent, original?.parent, `parent reference ${sample}/${target}`);
    }

    deepStrictEqual(plan, saved, `input unchanged ${sample}`);
}

console.log(JSON.stringify({ seed: 20261103, samples: 1000, comparisons: 17000, result: 'identical' }));
