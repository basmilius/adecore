import type { PlanApplied } from '../packages/plan/src/apply.ts';
import type { PlanVerdict } from '../packages/plan/src/permissions.ts';
import type { Plan, PlanItem, PlanStep } from '../packages/plan/src/protocol.ts';
import type { PerformanceCase } from './paired-performance';

type PermissionApi = Pick<typeof import('../packages/plan/src/tree'), 'holdsPersonState'> &
    Pick<typeof import('../packages/plan/src/permissions'), 'canApply' | 'canDeletePlan'> &
    Pick<typeof import('../packages/plan/src/apply'), 'applyPlanOps'>;

const NOW = '2026-11-01T00:00:00Z';

function planOf(item: PlanItem): Plan {
    return { id: 'plan', rev: 1, createdAt: NOW, meta: { title: 'Plan', kind: 'steps', checks: 'anyone' }, items: [item] };
}

function permissionWitness(result: unknown): string {
    const sink = globalThis as typeof globalThis & { __adecorePermissionResult?: unknown };
    sink.__adecorePermissionResult = result;

    if (typeof result === 'boolean') {
        return result ? 'held' : '';
    }

    const verdict = result as PlanVerdict | PlanApplied;

    if (!verdict.ok) {
        return `${verdict.code}:${verdict.message}`;
    }

    if ('plan' in verdict) {
        return `${verdict.plan.meta.title}:${verdict.plan.rev}:${verdict.plan.items.length}`;
    }

    return 'allowed';
}

export function planPermissionCases(before: PermissionApi, after: PermissionApi): PerformanceCase[] {
    const cases: PerformanceCase[] = [];

    for (const size of [1, 10, 100, 250]) {
        for (const position of ['none', 'first', 'last'] as const) {
            const steps: PlanStep[] = Array.from({ length: size }, (_, index) => ({
                type: 'step',
                id: `step-${index}`,
                title: `Step ${index}`,
                ...(index === (position === 'first' ? 0 : position === 'last' ? size - 1 : -1) ? ({ state: 'done', by: 'person', at: NOW } as const) : {})
            }));
            const section: PlanItem = { type: 'section', id: 'section', title: 'Section', items: steps };
            const plan = planOf(section);
            cases.push(
                { name: `holdsPersonState/${size}/${position}`, before: () => before.holdsPersonState(section), after: () => after.holdsPersonState(section) },
                {
                    name: `canDeletePlan/${size}/${position}`,
                    before: () => before.canDeletePlan(plan, 'agent'),
                    after: () => after.canDeletePlan(plan, 'agent')
                }
            );

            if (size === 100 || size === 250) {
                const options = { actor: 'agent', now: NOW } as const;
                const op = { op: 'remove', id: 'section' } as const;
                const expected = before.applyPlanOps(plan, [op], options);

                if (position === 'none' ? !expected.ok : expected.ok || expected.code !== 'set-by-person') {
                    throw new Error('Invalid remove permission fixture');
                }

                cases.push({
                    name: `applyPlanOps/remove/${size}/${position}`,
                    before: () => before.applyPlanOps(plan, [op], options),
                    after: () => after.applyPlanOps(plan, [op], options)
                });
            }
        }

        for (const check of ['none', 'first', 'last'] as const) {
            const steps: PlanStep[] = Array.from({ length: size }, (_, index) => ({
                type: 'step',
                id: `step-${index}`,
                title: `Step ${index}`,
                ...(index === (check === 'first' ? 0 : check === 'last' ? size - 1 : -1) ? ({ checks: 'person' } as const) : {})
            }));
            const section: PlanItem = { type: 'section', id: 'section', title: 'Section', items: steps };
            const plan = planOf(section);
            const remove = { op: 'remove', id: 'section' } as const;
            cases.push({
                name: `canApply/remove/${size}/checks-${check}`,
                before: () => before.canApply(remove, 'agent', plan),
                after: () => after.canApply(remove, 'agent', plan)
            });
        }

        const steps: PlanStep[] = Array.from({ length: size }, (_, index) => ({ type: 'step', id: `step-${index}`, title: `Step ${index}` }));
        const plan = planOf({ type: 'section', id: 'section', title: 'Section', items: steps });
        const person: Plan = { ...plan, meta: { ...plan.meta, checks: 'person' } };
        const title = { op: 'meta', title: 'Retitled' } as const;
        const checks = { op: 'meta', checks: 'agent' } as const;
        cases.push(
            { name: `canApply/meta-title/${size}`, before: () => before.canApply(title, 'agent', person), after: () => after.canApply(title, 'agent', person) },
            {
                name: `canApply/meta-checks/${size}/allowed`,
                before: () => before.canApply(checks, 'agent', plan),
                after: () => after.canApply(checks, 'agent', plan)
            },
            {
                name: `canApply/meta-checks/${size}/refused`,
                before: () => before.canApply(checks, 'agent', person),
                after: () => after.canApply(checks, 'agent', person)
            }
        );

        if (size === 100 || size === 250) {
            for (const count of [1, 100]) {
                const ops = Array.from({ length: count }, (_, index) => ({ ...title, title: `Retitled ${index}` }));
                const options = { actor: 'agent', now: NOW } as const;

                if (!before.applyPlanOps(person, ops, options).ok) {
                    throw new Error('Invalid metadata fixture');
                }

                cases.push({
                    name: `applyPlanOps/meta-title/${size}/${count}`,
                    before: () => before.applyPlanOps(person, ops, options),
                    after: () => after.applyPlanOps(person, ops, options)
                });
            }
        }
    }

    const leaf: PlanStep = { type: 'step', id: 'leaf', title: 'Leaf', state: 'open', by: 'person', steps: [] };
    cases.push({ name: 'holdsPersonState/leaf-empty', before: () => before.holdsPersonState(leaf), after: () => after.holdsPersonState(leaf) });

    return cases.map((entry) => {
        if (JSON.stringify(entry.before()) !== JSON.stringify(entry.after())) {
            throw new Error(`Different full results for ${entry.name}`);
        }

        return {
            name: entry.name,
            before: () => permissionWitness(entry.before()),
            after: () => permissionWitness(entry.after())
        };
    });
}
