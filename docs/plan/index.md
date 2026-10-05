# @adecore/plan

A plan that a person and an agent work through together: steps, sub-steps, sections and notes, with rules for who may check what. The agent builds and updates the plan; the person checks steps off, and what a person checked stays checked. Every change goes through one function that applies a batch of operations as a whole or refuses it with a code and a reason.

```sh
bun add @adecore/plan
```

```ts
import { applyPlanOps, createPlan } from '@adecore/plan';

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

if (created.ok) {
    const result = applyPlanOps(created.plan, [{ op: 'set', ids: ['tests'], state: 'done', next: 'approve' }], {
        actor: 'agent',
        now: new Date().toISOString()
    });
    // { ok: false, code: 'person-only', message: 'Only a person checks "approve"' }
}
```

<Demo src="canvas/plan-checklist" />

Check steps as a person, then switch to the agent and try again. Typecheck and Tests are the agent's until a person unlocks them, Approve is the person's, and every accepted batch raises `rev` by one. Under the checklist is the plan as `planToMarkdown` writes it.

## What is in it

- [Plans](/plan/plans): the tree of sections, text blocks and steps, the state of a step and of its parent, progress, and creating a plan from a draft.
- [Operations](/plan/operations): `applyPlanOps`, the eight operations, who may send which, and every refusal.
- [Markdown and text](/plan/markdown): reading and writing a plan as a Markdown task list, and the compact text an agent reads.

Schemas and types are on `@adecore/plan/protocol`; the behavior is on `@adecore/plan`. Both only need Zod. The package has no storage, no clock and no transport, and it runs the same in a page, a backend and a test.

## What the app does

- Who is asking. `actor` is `person` or `agent`, and the package believes it, so the app takes it from a session it verified, never from the request body.
- The time. Every call that writes a state takes `now`, so a test never reads the clock.
- Storage. Operations name items by id, not a base revision, so a person's click and an agent's update do not conflict. That makes the app responsible for applying each batch to the latest stored plan and saving the result in one transaction; see [in a store](/plan/operations#in-a-store).
