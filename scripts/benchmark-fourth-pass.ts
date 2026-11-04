import { resolve } from 'node:path';
import type { ProviderAccounts } from '../packages/agent-contracts/src/provider-accounts';
import { measurePairs } from './paired-performance';
import { planCases } from './plan-performance-cases';

const baselineRoot = process.argv[2];
if (!baselineRoot) {
    throw new Error('Usage: bun --conditions=source scripts/benchmark-fourth-pass.ts <baseline checkout>');
}

const before = {
    ...(await import(resolve(baselineRoot, 'packages/plan/src/apply.ts'))),
    ...(await import(resolve(baselineRoot, 'packages/agents/src/usage/accounts.ts')))
};
const after = { ...(await import('../packages/plan/src/apply')), ...(await import('../packages/agents/src/usage/accounts')) };
const cases = planCases(before, after);

for (const size of [6, 31, 32, 100, 500]) {
    const ids = Array.from({ length: size }, (_, index) => (index === 0 ? 'claude' : `account-${index}`));
    const snapshot: ProviderAccounts = {
        accounts: Object.fromEntries(ids.map((id) => [id, { kind: 'claude' }])),
        statuses: ids.map((id) => ({ id, kind: 'claude', state: 'ready', email: null, plan: null, organization: null, home: '', message: null, checkedAt: 0 }))
    };
    const nameOf = () => 'Claude';
    cases.push({
        name: `machineAccounts/${size}`,
        before: () => before.machineAccounts(snapshot, nameOf),
        after: () => after.machineAccounts(snapshot, nameOf)
    });
    if (size === 100) {
        const empty = { ...snapshot, statuses: [] };
        const unsupported: ProviderAccounts = { ...snapshot, accounts: Object.fromEntries(ids.map((id) => [id, { kind: 'other' }])) };
        cases.push({
            name: 'machineAccounts/100/no-statuses',
            before: () => before.machineAccounts(empty, nameOf),
            after: () => after.machineAccounts(empty, nameOf)
        });
        cases.push({
            name: 'machineAccounts/100/unsupported',
            before: () => before.machineAccounts(unsupported, nameOf),
            after: () => after.machineAccounts(unsupported, nameOf)
        });
    }
}
console.log(JSON.stringify({ runtime: Bun.version, baselineRoot, ...measurePairs(cases) }, null, 2));
