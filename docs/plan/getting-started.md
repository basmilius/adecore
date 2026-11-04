# Getting started

This page creates a plan, changes it as the agent and as a person, and writes it out as Markdown and as text for the agent.

## Install

```sh
bun add @adecore/plan
```

The package has no peer dependencies and brings Zod. A store that only validates plans can import the schemas from `@adecore/plan/protocol`.

## Create a plan

`createPlan` turns a draft into a plan at `rev` 0. The app passes the plan's id and the time:

```ts
import { createPlan } from '@adecore/plan';

const created = createPlan(
    {
        meta: { title: 'Ship the release' },
        items: [
            { type: 'step', id: 'tests', title: 'Run the tests', checks: 'agent' },
            { type: 'step', id: 'approve', title: 'Approve the release', checks: 'person' }
        ]
    },
    { id: 'release', now: new Date().toISOString() }
);

if (!created.ok) {
    throw new Error(created.message);
}

let plan = created.plan;
```

`checks: 'agent'` means only the agent checks the tests until a person unlocks them. `checks: 'person'` means only a person approves.

## Change it

Every change is a batch of operations from one actor. The agent finishes the tests:

```ts
import { applyPlanOps } from '@adecore/plan';

const ran = applyPlanOps(plan, [{ op: 'set', ids: ['tests'], state: 'done' }], { actor: 'agent', now: new Date().toISOString() });

if (ran.ok) {
    plan = ran.plan;
}
```

The plan is now at `rev` 1. When the agent tries to approve as well, `applyPlanOps` refuses the batch and the plan stays as it was:

```ts
applyPlanOps(plan, [{ op: 'set', ids: ['approve'], state: 'done' }], { actor: 'agent', now: new Date().toISOString() });
// { ok: false, code: 'person-only', message: 'Only a person checks "approve"' }
```

A person may:

```ts
const approved = applyPlanOps(plan, [{ op: 'set', ids: ['approve'], state: 'done' }], { actor: 'person', now: new Date().toISOString() });

if (approved.ok) {
    plan = approved.plan;
}
```

Take `actor` from a verified session, never from what the request says. [Permissions](/plan/permissions) has the full rules.

## Write it out

```ts
import { planToMarkdown, progressText, renderPlanText } from '@adecore/plan';

progressText(plan);
// '2 of 2 done'

planToMarkdown(plan);
// # Ship the release
//
// - [x] Run the tests
// - [x] Approve the release

renderPlanText(plan);
// Plan "Ship the release" (release, steps, rev 2): 2 of 2 done
//
// [x] 1 Run the tests [tests] agent-only
// [x] 2 Approve the release [approve] person-only, set by a person 09:10
```

Markdown is for a person to read or paste. The text keeps the ids, so the agent can name the steps in its next batch.

## Load it again

Store the plan as JSON. When you load it, check the whole tree:

```ts
import { validatePlan } from '@adecore/plan';

const loaded = validatePlan(JSON.parse(stored));
```

## Checklist

- `actor` comes from a verified session.
- Each batch is applied to the latest stored plan, in one transaction or one queue per plan.
- A refusal's `message` goes back to the agent, so it can correct its next batch.
- Every loaded plan goes through `validatePlan`.
