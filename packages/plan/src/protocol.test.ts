import { describe, expect, test } from 'bun:test';
import { createPlan, parsePlanDraft, validatePlan } from './index.ts';
import {
    PLAN_LIMITS,
    PlanActorSchema,
    PlanChecksSchema,
    PlanKindSchema,
    PlanOpSchema,
    PlanPersonOpSchema,
    PlanSchema,
    PlanStepStateSchema,
    type Plan,
    type PlanOp
} from './protocol.ts';

const saved: Plan = {
    id: 'test-plan',
    rev: 7,
    createdAt: '2026-01-01T00:00:00.000Z',
    meta: { title: 'Verify delivery', kind: 'test', checks: 'anyone', summary: 'Release checks', status: 'Reviewing' },
    items: [
        { type: 'text', id: 'intro', title: 'Before starting', description: 'Use the test environment.' },
        {
            type: 'section',
            id: 'checks',
            title: 'Checks',
            items: [
                {
                    type: 'step',
                    id: 'delivery',
                    title: 'Delivery',
                    steps: [
                        {
                            type: 'step',
                            id: 'confirm',
                            title: 'Confirm',
                            state: 'warning',
                            checks: 'agent',
                            unlocked: true,
                            by: 'person',
                            at: '2026-01-01T01:00:00.000Z',
                            note: 'Review the result'
                        }
                    ]
                }
            ]
        }
    ]
};

describe('persisted plan schemas', () => {
    test('nested steps, permissions and attribution survive a JSON round trip', () => {
        const value = JSON.parse(JSON.stringify(saved));
        expect(PlanSchema.parse(value)).toEqual(saved);
        expect(validatePlan(value)).toEqual({ ok: true, plan: saved });
    });

    test('optional fields stay absent and unknown persisted fields are stripped', () => {
        const parsed = PlanSchema.parse({ ...saved, future: true, items: [{ type: 'step', id: 'plain', title: 'Plain', future: true }] });
        expect(parsed).not.toHaveProperty('future');
        expect(parsed.items).toEqual([{ type: 'step', id: 'plain', title: 'Plain' }]);
    });

    test('enum order stays compatible with generated consumers', () => {
        expect(PlanStepStateSchema.options).toEqual(['open', 'active', 'done', 'failed', 'skipped', 'blocked', 'warning', 'info']);
        expect(PlanChecksSchema.options).toEqual(['anyone', 'agent', 'person']);
        expect(PlanActorSchema.options).toEqual(['person', 'agent']);
        expect(PlanKindSchema.options).toEqual(['steps', 'test']);
        expect(PLAN_LIMITS).toEqual({ idLength: 64, title: 200, description: 1000, note: 500, status: 200, depth: 5, items: 300, plansPerChat: 20 });
    });

    test('invalid identities, revisions, states and nested sections are refused', () => {
        for (const value of [
            { ...saved, id: 'Invalid' },
            { ...saved, id: 'a'.repeat(65) },
            { ...saved, rev: -1 },
            { ...saved, rev: 1.5 },
            { ...saved, meta: { ...saved.meta, title: '' } },
            { ...saved, items: [{ type: 'step', id: 'one', title: 'One', state: 'approved' }] },
            { ...saved, items: [{ type: 'section', id: 'outer', title: 'Outer', items: [{ type: 'section', id: 'inner', title: 'Inner', items: [] }] }] }
        ]) {
            expect(PlanSchema.safeParse(value).success).toBe(false);
        }
    });
});

describe('operation and draft schemas', () => {
    test('all operation kinds parse with the same optional positioning and clearing fields', () => {
        const operations: PlanOp[] = [
            { op: 'set', ids: ['confirm'], state: 'done', note: '', next: 'other' },
            { op: 'note', id: 'confirm', text: '' },
            { op: 'unlock', ids: 'all' },
            { op: 'unlock', ids: ['confirm'] },
            { op: 'add', type: 'step', title: 'New', under: 'delivery', after: 'confirm' },
            { op: 'edit', id: 'confirm', description: '', checks: 'person' },
            { op: 'move', id: 'confirm', after: 'other' },
            { op: 'remove', id: 'confirm' },
            { op: 'meta', summary: '', status: '' }
        ];
        for (const operation of operations) {
            expect(PlanOpSchema.parse(operation)).toEqual(operation);
        }
        expect(PlanPersonOpSchema.safeParse(operations[4]).success).toBe(false);
        expect(PlanPersonOpSchema.parse(operations[2])).toEqual({ op: 'unlock', ids: 'all' });
        expect(PlanOpSchema.safeParse({ op: 'set', ids: [], state: 'done' }).success).toBe(false);
        expect(PlanOpSchema.safeParse({ op: 'unlock', ids: [] }).success).toBe(false);
        expect(PlanOpSchema.safeParse({ op: 'note', id: 'confirm', text: 'a'.repeat(501) }).success).toBe(false);
    });

    test('agent drafts refuse host attribution and unknown fields', () => {
        expect(parsePlanDraft({ items: [{ type: 'step', title: 'Check', by: 'person' }] }).ok).toBe(false);
        expect(parsePlanDraft({ items: [{ type: 'step', title: 'Check', unlocked: true }] }).ok).toBe(false);
        expect(parsePlanDraft({ items: [], extra: true }).ok).toBe(false);
    });

    test('creation supplies host timestamps, ids and agent attribution', () => {
        const result = createPlan(
            { items: [{ type: 'step', title: 'Check', state: 'done' }] },
            {
                id: 'new-plan',
                now: saved.createdAt,
                mintId: () => 'new-step',
                meta: { title: 'New' }
            }
        );
        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error(result.message);
        }
        expect(result.plan).toEqual({
            id: 'new-plan',
            rev: 0,
            createdAt: saved.createdAt,
            meta: { title: 'New', kind: 'steps', checks: 'anyone' },
            items: [{ type: 'step', id: 'new-step', title: 'Check', state: 'done', by: 'agent', at: saved.createdAt }]
        });
    });
});
