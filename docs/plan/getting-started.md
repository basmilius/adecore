# Getting started

Use a strict draft for creation. The host supplies the plan id and time; creation mints any missing item ids and attributes initial states to the agent.

This example has one agent-only step and one person-only step. It demonstrates a locked click, a person's unlock, a protected person state and a refused batch that leaves its input unchanged.

```ts
import { applyPlanOps, createPlan, parsePlanDraft, renderPlanText } from '@adecore/plan';

const parsed = parsePlanDraft({
    meta: { title: 'Delivery', checks: 'agent' },
    items: [
        { type: 'step', id: 'build', title: 'Build the result', state: 'active' },
        { type: 'step', id: 'review', title: 'Review the result', checks: 'person' }
    ]
});
if (!parsed.ok) {
    throw new Error(parsed.message);
}
const created = createPlan(parsed.draft, { id: 'delivery', now: '2026-01-01T00:00:00.000Z' });
if (!created.ok) {
    throw new Error(created.message);
}

const locked = applyPlanOps(created.plan, [{ op: 'set', ids: ['build'], state: 'done' }], {
    actor: 'person',
    now: '2026-01-01T00:01:00.000Z'
});
console.log(locked.ok ? 'unexpected' : locked.code);

const checked = applyPlanOps(
    created.plan,
    [
        { op: 'unlock', ids: ['build'] },
        { op: 'set', ids: ['build'], state: 'done' }
    ],
    { actor: 'person', now: '2026-01-01T00:02:00.000Z' }
);
if (!checked.ok) {
    throw new Error(checked.message);
}

const protectedState = applyPlanOps(checked.plan, [{ op: 'set', ids: ['build'], state: 'failed' }], {
    actor: 'agent',
    now: '2026-01-01T00:03:00.000Z'
});
console.log(protectedState.ok ? 'unexpected' : protectedState.code);

const before = JSON.stringify(checked.plan);
const refusedBatch = applyPlanOps(
    checked.plan,
    [
        { op: 'note', id: 'build', text: 'Verified by the host' },
        { op: 'set', ids: ['review'], state: 'done' }
    ],
    { actor: 'agent', now: '2026-01-01T00:04:00.000Z' }
);
console.log(refusedBatch.ok ? 'unexpected' : refusedBatch.code);
console.log(JSON.stringify(checked.plan) === before);
console.log(checked.plan.rev);
console.log(renderPlanText(checked.plan, { formatTime: (at) => at.slice(11, 16) }));
```

The refusal codes are `step-locked`, `set-by-person` and `person-only`. The successful unlock-and-set batch produces revision `1`; both operations share one revision. The refused note-and-set batch leaves the previous plan byte-for-byte unchanged. The input to the original creation also remains unchanged.

Always narrow a result with `ok` before reading `plan`, `draft` or refusal fields. Returning a refusal is expected behavior. A host should display its code/message and retain the stored plan.

## Local source and compiled use

The package is private at `0.0.0`. Use a workspace dependency or linked checkout. Source consumers enable `source` in bundler conditions and TypeScript's `customConditions`; Bun supports `--conditions=source`.

For default imports, build from the repository root:

```sh
bun run --cwd packages/plan build
```

The root and `@adecore/plan/protocol` then resolve JavaScript/declarations in `dist`. Browser, Node and Bun can use the core. Automatic id generation needs Web Crypto; tests or hosts with another id policy can inject `mintId`. No CSS or i18n setup is required.

TypeScript source checking uses `moduleResolution: 'bundler'`, `customConditions: ['source']` and `allowImportingTsExtensions: true`. Compiled Node consumers can use `NodeNext` resolution without the source condition.
