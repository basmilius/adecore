import { applyPlanOps, createPlan, parsePlanMarkdown, planToMarkdown } from '../src/index.ts';

const parsed = parsePlanMarkdown('# Delivery\n\n- [ ] Review the result\n');
if (!parsed.ok) {
    throw new Error(parsed.message);
}
const created = createPlan(parsed.draft, { id: 'delivery', now: '2026-01-01T00:00:00.000Z', mintId: () => 'review' });
if (!created.ok) {
    throw new Error(created.message);
}
const checked = applyPlanOps(created.plan, [{ op: 'set', ids: ['review'], state: 'done' }], { actor: 'person', now: '2026-01-01T00:01:00.000Z' });
if (!checked.ok) {
    throw new Error(checked.message);
}
console.log(planToMarkdown(checked.plan));
