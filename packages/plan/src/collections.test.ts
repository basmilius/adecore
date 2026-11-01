import { describe, expect, it } from 'bun:test';
import type { PlanItem, PlanStep } from './protocol';
import { activeStepIds, allSteps, leafSteps, planProgress } from './tree';

describe('plan collections', () => {
    it('keeps document order and references while only leaves contribute state', () => {
        const child: PlanStep = { type: 'step', id: 'child', title: 'Child', state: 'active' };
        const parent: PlanStep = { type: 'step', id: 'parent', title: 'Parent', state: 'failed', steps: [child] };
        const empty: PlanStep = { type: 'step', id: 'empty', title: 'Empty children', state: 'active', steps: [] };
        const last: PlanStep = { type: 'step', id: 'last', title: 'Last', state: 'warning' };
        const note: PlanItem = { type: 'text', id: 'note', title: 'A note between steps' };
        const items: PlanItem[] = [{ type: 'section', id: 'section', title: 'Section', items: [note, parent, empty] }, last, note];
        const steps = allSteps(items);
        const leaves = leafSteps(items);

        expect(steps).toEqual([parent, child, empty, last]);
        expect(leaves).toEqual([child, empty, last]);
        expect(steps.every((step, index) => step === [parent, child, empty, last][index])).toBe(true);
        expect(leaves.every((step, index) => step === [child, empty, last][index])).toBe(true);
        expect(activeStepIds({ items })).toEqual(['child', 'empty']);
        expect(planProgress(items)).toEqual({ total: 3, open: 0, active: 2, done: 0, failed: 0, skipped: 0, blocked: 0, warning: 1, info: 0, finished: 1 });
    });
});
