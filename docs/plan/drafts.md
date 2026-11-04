# Creating a plan

An agent proposes a plan as a `PlanDraft`. It is the same tree as a [plan](/plan/plans) without `by`, `at` or `unlocked`, with optional ids and meta. A draft can also come from [Markdown](/plan/markdown).

## Parsing a draft

The draft schemas are strict and refuse a misspelled field by its path instead of dropping it. `parsePlanDraft` checks a whole draft and returns `{ ok: true, draft }` or a `plan-invalid` refusal:

```ts
import { createPlan, parsePlanDraft } from '@adecore/plan';

const draft = parsePlanDraft(JSON.parse(body));
const created = draft.ok ? createPlan(draft.draft, { id: 'release', now: new Date().toISOString() }) : draft;
```

`PlanDraftMetaSchema` checks the meta, and `PlanDraftSectionSchema`, `PlanDraftTextSchema` and `PlanDraftStepSchema` check one item each. Their types are `PlanDraftSection`, `PlanDraftText` and `PlanDraftStep`, a `PlanDraftItem` is any of the three, and `PlanDraft` is the whole draft. They live on `@adecore/plan`, not on the protocol entry point.

## createPlan

`createPlan(draft, options)` takes a `PlanCreateOptions` and returns `{ ok: true, plan, minted, dropped }` at `rev` 0, or a refusal.

- The title comes from `options.meta` or the draft, and `options.meta` wins.
- `kind` defaults to `steps`, `checks` to `anyone`.
- A state in the draft counts as the agent's, so `createPlan` refuses a state on a step only a person checks.
- `createPlan` checks the [limits](/plan/plans#ids-and-limits).

```ts
const created = createPlan(
    {
        meta: { title: 'Ship the release' },
        items: [
            { type: 'step', id: 'tests', title: 'Run the tests', checks: 'agent', state: 'active' },
            { type: 'step', id: 'approve', title: 'Approve the release', checks: 'person' }
        ]
    },
    { id: 'release', now: new Date().toISOString() }
);
```

## Ids

Items without an id get one from `options.mintId`, or from `randomItemId` (six random lowercase letters and digits). `minted` lists the new ids.

Pass `mintId` for predictable ids in tests:

```ts
let count = 0;

const created = createPlan(draft, { id: 'release', now: '2026-11-04T09:00:00.000Z', mintId: () => `item-${++count}` });
```

A `mintId` that keeps returning taken ids ends in a `duplicate-id` refusal.
