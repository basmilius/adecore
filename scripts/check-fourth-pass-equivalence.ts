import { deepStrictEqual } from 'node:assert';
import { resolve } from 'node:path';
import type { ProviderAccounts } from '../packages/agent-contracts/src/provider-accounts';
import type { PlanDraft } from '../packages/plan/src/apply';
import type { Plan, PlanOp } from '../packages/plan/src/protocol';

const baselineRoot = process.argv[2];

if (!baselineRoot) {
    throw new Error('Usage: bun --conditions=source scripts/check-fourth-pass-equivalence.ts <baseline checkout>');
}
async function load(root: string) {
    return { ...(await import(resolve(root, 'packages/plan/src/apply.ts'))), ...(await import(resolve(root, 'packages/agents/src/usage/accounts.ts'))) };
}
const before = await load(resolve(baselineRoot));
const after = await load(resolve(import.meta.dir, '..'));
const now = '2026-10-31T12:00:00Z';
let seed = 20261101;
function random(limit: number): number {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % limit;
}
for (let sample = 0; sample < 1000; sample++) {
    const count = random(50) + 1;
    const plan: Plan = {
        id: 'plan',
        rev: 1,
        createdAt: now,
        meta: { title: 'Plan', kind: 'steps', checks: 'anyone' },
        items: Array.from({ length: count }, (_, index) => ({ type: 'step', id: `s${index}`, title: `Step ${index}` }))
    };
    const ops: PlanOp[] = Array.from({ length: random(15) + 1 }, () => {
        const id = `s${random(count)}`;
        switch (random(7)) {
            case 0:
                return { op: 'note', id, text: 'Note' };
            case 1:
                return { op: 'set', ids: [id], state: 'done' };
            case 2:
                return { op: 'add', type: 'step', title: 'Added', ...(random(2) ? { id: `explicit-${random(4)}` } : {}) };
            case 3:
                return { op: 'remove', id };
            case 4:
                return { op: 'edit', id, title: 'Edited' };
            case 5:
                return { op: 'move', id, after: `s${random(count)}` };
            default:
                return { op: 'meta', summary: 'Summary' };
        }
    });
    const actor = random(2) ? ('agent' as const) : ('person' as const);
    const apply = (api: typeof before) => {
        let calls = 0;
        const result = api.applyPlanOps(plan, ops, { actor, now, mintId: () => (calls++ === 0 ? 's0' : `mint-${calls}`) });
        return { result, calls };
    };
    deepStrictEqual(apply(after), apply(before), `applyPlanOps ${sample}`);
    const draft: PlanDraft = {
        meta: { title: 'Draft' },
        items: Array.from({ length: count }, (_, index) => ({ type: 'step', title: `Step ${index}`, ...(random(2) ? { id: `fixed-${index % 17}` } : {}) }))
    };
    const create = (api: typeof before) => {
        let calls = 0;
        const result = api.createPlan(draft, { id: 'plan', now, mintId: () => `mint-${calls++}` });
        return { result, calls };
    };
    deepStrictEqual(create(after), create(before), `createPlan ${sample}`);
    const ids = Array.from({ length: random(100) }, (_, index) => (index === 0 ? 'claude' : `account-${index}`));
    const snapshot: ProviderAccounts = {
        accounts: Object.fromEntries(ids.map((id) => [id, { kind: random(4) ? 'claude' : 'other' }])),
        statuses: Array.from({ length: random(120) }, () => ({
            id: ids[random(Math.max(1, ids.length))] ?? 'missing',
            kind: 'claude',
            state: random(2) ? 'ready' : 'signed-out',
            email: null,
            plan: null,
            organization: null,
            home: '',
            message: null,
            checkedAt: 0
        }))
    };
    const accounts = (api: typeof before) => {
        const named: string[] = [];
        const result = api.machineAccounts(snapshot, (kind: string) => {
            named.push(kind);
            return 'CLI';
        });
        return { result, named };
    };
    deepStrictEqual(accounts(after), accounts(before), `machineAccounts ${sample}`);
}
console.log(JSON.stringify({ seed: 20261101, samples: 1000, comparisons: 3000, result: 'identical' }));
