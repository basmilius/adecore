import type { Plan, PlanOp } from '../packages/plan/src/protocol';
import type { PlanDraft } from '../packages/plan/src/apply';
import type { PerformanceCase } from './paired-performance';

type PlanApi = Pick<typeof import('../packages/plan/src/apply'), 'applyPlanOps' | 'createPlan'>;

export function planCases(before: PlanApi, after: PlanApi): PerformanceCase[] {
    const cases: PerformanceCase[] = [];
    const now = '2026-10-31T12:00:00Z';

    for (const size of [10, 100, 250]) {
        const plan: Plan = {
            id: 'plan',
            rev: 1,
            createdAt: now,
            meta: { title: 'Benchmark', kind: 'steps', checks: 'anyone' },
            items: Array.from({ length: size }, (_, index) => ({ type: 'step', id: `step-${index}`, title: `Step ${index}` }))
        };

        for (const count of [1, 10, 100]) {
            for (const position of ['first', 'last', 'spread'] as const) {
                const ops: PlanOp[] = Array.from({ length: count }, (_, index) => ({
                    op: 'note',
                    id: `step-${position === 'first' ? 0 : position === 'last' ? size - 1 : Math.floor((index * size) / count) % size}`,
                    text: 'Observed'
                }));
                const options = { actor: 'agent' as const, now };

                if (!before.applyPlanOps(plan, ops, options).ok) {
                    throw new Error('Invalid plan operation fixture');
                }

                cases.push({
                    name: `applyPlanOps/${size}/${count}-${position}`,
                    before: () => before.applyPlanOps(plan, ops, options),
                    after: () => after.applyPlanOps(plan, ops, options)
                });
            }
        }

        const draft: PlanDraft = {
            meta: { title: 'Benchmark' },
            items: Array.from({ length: Math.ceil(size / 10) }, (_, section) => ({
                type: 'section',
                title: `Section ${section}`,
                items: Array.from({ length: Math.min(10, size - section * 10) }, (_, index) => ({ type: 'step', title: `Step ${section}-${index}` }))
            }))
        };
        const create = (api: PlanApi) => {
            let next = 0;

            return api.createPlan(draft, { id: 'plan', now, mintId: () => `mint-${next++}` });
        };
        if (!create(before).ok) {
            throw new Error('Invalid plan creation fixture');
        }

        cases.push({ name: `createPlan/${size}`, before: () => create(before), after: () => create(after) });
    }
    return cases;
}
