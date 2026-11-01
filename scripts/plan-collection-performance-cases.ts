import { PlanSchema, type Plan, type PlanStep, type PlanStepState } from '../packages/plan/src/protocol';
import type { PerformanceCase } from './paired-performance';

type PlanCollections = Pick<typeof import('../packages/plan/src/tree'), 'allSteps' | 'leafSteps' | 'activeStepIds' | 'planProgress'> &
    Pick<typeof import('../packages/plan/src/text'), 'progressText' | 'renderPlanText'>;

function observe(result: unknown): string {
    const sink = globalThis as typeof globalThis & { __adecoreCollectionResult?: unknown };
    sink.__adecoreCollectionResult = result;

    return typeof result === 'string' ? result : Array.isArray(result) ? String(result.length) : String((result as { total: number }).total);
}

export function planCollectionCases(before: PlanCollections, after: PlanCollections): PerformanceCase[] {
    const cases: PerformanceCase[] = [];
    const states: PlanStepState[] = ['open', 'active', 'done', 'failed', 'blocked', 'skipped', 'warning', 'info'];

    for (const size of [0, 1, 10, 100, 250]) {
        for (const shape of ['flat', 'nested'] as const) {
            const steps: PlanStep[] = Array.from({ length: size }, (_, index) => ({
                type: 'step',
                id: `step-${index}`,
                title: `Step ${index}`,
                state: states[index % states.length],
                ...(index % 2 === 0 ? { steps: [] } : {})
            }));
            const children: PlanStep[] = [];

            if (shape === 'flat') {
                children.push(...steps);
            } else {
                for (let index = 0; index < steps.length; index += 8) {
                    children.push({ type: 'step', id: `parent-${index}`, title: `Parent ${index}`, steps: steps.slice(index, index + 8) });
                }
            }

            const plan: Plan = {
                id: 'collection',
                rev: 1,
                createdAt: '2026-11-01T00:00:00Z',
                meta: { title: 'Collection fixture', kind: 'steps', checks: 'anyone' },
                items: [{ type: 'section', id: 'section', title: 'Section', items: children }]
            };
            PlanSchema.parse(plan);

            for (const name of ['allSteps', 'leafSteps', 'activeStepIds', 'planProgress', 'progressText', 'renderPlanText'] as const) {
                const run = (api: PlanCollections): unknown => {
                    switch (name) {
                        case 'allSteps':
                            return api.allSteps(plan.items);
                        case 'leafSteps':
                            return api.leafSteps(plan.items);
                        case 'activeStepIds':
                            return api.activeStepIds(plan);
                        case 'planProgress':
                            return api.planProgress(plan.items);
                        case 'progressText':
                            return api.progressText(plan);
                        case 'renderPlanText':
                            return api.renderPlanText(plan, { formatTime: (value) => value });
                    }
                };

                if (JSON.stringify(run(before)) !== JSON.stringify(run(after))) {
                    throw new Error(`Plan collection differs: ${name}/${size}/${shape}`);
                }

                cases.push({ name: `${name}/${size}/${shape}`, before: () => observe(run(before)), after: () => observe(run(after)) });
            }
        }
    }

    return cases;
}
