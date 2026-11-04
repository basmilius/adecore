import { deepStrictEqual } from 'node:assert';
import { resolve } from 'node:path';
import * as permissions from '../packages/plan/src/permissions.ts';
import type { Plan, PlanItem, PlanOp, PlanStep, PlanStepState } from '../packages/plan/src/protocol.ts';
import * as tree from '../packages/plan/src/tree.ts';

const beforeRoot = process.argv[2];

if (!beforeRoot) {
    throw new Error('Usage: bun --conditions=source scripts/check-plan-permission-equivalence.ts <before checkout>');
}

const before = {
    ...(await import(resolve(beforeRoot, 'packages/plan/src/tree.ts'))),
    ...(await import(resolve(beforeRoot, 'packages/plan/src/permissions.ts')))
};
const states: (PlanStepState | undefined)[] = [undefined, 'open', 'active', 'done', 'failed', 'skipped', 'blocked', 'warning', 'info'];
const checks = [undefined, 'person', 'agent', 'anyone'] as const;
let seed = 20261104;

function random(limit: number): number {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

    return (seed >>> 8) % limit;
}

for (let sample = 0; sample < 1000; sample++) {
    let next = 0;
    const ids: string[] = [];
    const id = (): string => {
        const value = `item-${sample % 11 === 0 ? next % 5 : next}`;
        next++;
        ids.push(value);

        return value;
    };
    const step = (depth: number): PlanStep => {
        const result: PlanStep = {
            type: 'step',
            id: id(),
            title: 'Step',
            state: states[random(states.length)],
            checks: checks[random(checks.length)],
            by: random(3) === 0 ? undefined : random(2) === 0 ? 'person' : 'agent',
            unlocked: random(4) === 0
        };

        if (depth < 3 && next < 100 && random(3) === 0) {
            result.steps = Array.from({ length: random(4) }, () => step(depth + 1));
        } else if (random(3) === 0) {
            result.steps = [];
        }

        return result;
    };
    const items: PlanItem[] = Array.from({ length: random(20) }, (_, index): PlanItem =>
        index % 4 === 0
            ? { type: 'text', id: id(), title: 'Text' }
            : index % 4 === 1
              ? { type: 'section', id: id(), title: 'Section', items: Array.from({ length: random(5) }, () => step(1)) }
              : step(1)
    );
    const plan: Plan = { id: 'plan', rev: 1, createdAt: '2026-11-01T00:00:00Z', meta: { title: 'Plan', kind: 'steps', checks: checks[1 + random(3)]! }, items };
    const target = ids[random(ids.length || 1)] ?? 'missing';
    const other = random(3) === 0 ? 'missing' : (ids[random(ids.length || 1)] ?? 'missing');
    const ops: PlanOp[] = [
        { op: 'set', ids: [target], state: states[1 + random(states.length - 1)]! },
        { op: 'note', id: target, text: 'Note' },
        { op: 'unlock', ids: random(2) === 0 ? 'all' : [target] },
        { op: 'add', type: 'step', title: 'Added', under: target, checks: checks[random(checks.length)] },
        { op: 'edit', id: target, title: 'Changed', checks: checks[random(checks.length)] },
        { op: 'move', id: target, under: other },
        { op: 'remove', id: target },
        { op: 'meta', title: 'Retitled' },
        { op: 'meta', summary: 'Summary' },
        { op: 'meta', checks: 'agent' },
        { op: 'meta', checks: 'person' },
        { op: 'meta', checks: 'anyone' },
        { op: 'add', type: 'text', title: 'Text', after: target },
        { op: 'edit', id: target, description: 'Description' }
    ];
    const saved = structuredClone(plan);
    const selected: PlanItem = items[random(items.length || 1)] ?? { type: 'text', id: 'empty', title: 'Empty' };
    deepStrictEqual(tree.holdsPersonState(selected), before.holdsPersonState(selected), `person state ${sample}`);

    for (const actor of ['agent', 'person'] as const) {
        deepStrictEqual(permissions.canDeletePlan(plan, actor), before.canDeletePlan(plan, actor), `delete ${sample}/${actor}`);

        for (const [index, op] of ops.entries()) {
            deepStrictEqual(permissions.canApply(op, actor, plan), before.canApply(op, actor, plan), `permission ${sample}/${actor}/${index}`);
        }
    }

    deepStrictEqual(plan, saved, `input unchanged ${sample}`);
}

console.log(JSON.stringify({ seed: 20261104, samples: 1000, operationsPerActor: 14, actors: 2, comparisons: 32000, result: 'identical' }));
