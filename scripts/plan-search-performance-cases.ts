import type { Plan, PlanItem, PlanStep, PlanText } from '../packages/plan/src/protocol.ts';
import type { PerformanceCase } from './paired-performance';
import { planCases } from './plan-performance-cases';

type SearchApi = Pick<typeof import('../packages/plan/src/tree'), 'locateItem'> &
    Pick<typeof import('../packages/plan/src/apply'), 'applyPlanOps' | 'createPlan'>;

export function planSearchCases(before: SearchApi, after: SearchApi): PerformanceCase[] {
    const cases: PerformanceCase[] = [];

    for (const size of [10, 100, 250]) {
        const leaves: (PlanStep | PlanText)[] = Array.from({ length: size }, (_, index) =>
            index % 7 === 0
                ? { type: 'text', id: `item-${index}`, title: `Text ${index}` }
                : { type: 'step', id: `item-${index}`, title: `Step ${index}`, ...(index % 3 === 0 ? { steps: [] } : {}) }
        );

        for (const shape of ['flat', 'sections']) {
            const items: PlanItem[] =
                shape === 'flat'
                    ? leaves
                    : Array.from({ length: Math.ceil(size / 10) }, (_, index) => ({
                          type: 'section',
                          id: `section-${index}`,
                          title: `Section ${index}`,
                          items: leaves.slice(index * 10, index * 10 + 10)
                      }));
            const plan: Pick<Plan, 'items'> = { items };

            for (const position of ['first', 'middle', 'last', 'missing']) {
                const id = position === 'missing' ? 'missing' : `item-${position === 'first' ? 0 : position === 'middle' ? Math.floor(size / 2) : size - 1}`;
                cases.push({
                    name: `locateItem/${size}/${shape}/${position}`,
                    before: () => before.locateItem(plan, id),
                    after: () => after.locateItem(plan, id)
                });
            }
        }
    }

    const selected = new Set([
        'applyPlanOps/10/1-first',
        'applyPlanOps/100/10-last',
        'applyPlanOps/250/100-last',
        'applyPlanOps/250/100-spread',
        'createPlan/250'
    ]);
    cases.push(...planCases(before, after).filter((entry) => selected.has(entry.name)));

    return cases;
}
