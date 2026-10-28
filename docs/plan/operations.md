# Operations

Every change to a plan is a batch of operations from one actor:

```ts
import { applyPlanOps } from '@adecore/plan';

const result = applyPlanOps(plan, [{ op: 'set', ids: ['tests'], state: 'done', next: 'publish' }], {
    actor: 'agent',
    now: new Date().toISOString()
});

if (result.ok) {
    save(result.plan);
} else {
    reply(result.code, result.message);
}
```

`applyPlanOps(plan, ops, options)` works on a copy. Each operation sees the ones before it. The batch is all or nothing: one refusal leaves your plan untouched. A batch that passes raises `rev` by one.

`options` is a `PlanApplyOptions`: the `actor`, the `now` written into `at`, and an optional `mintId`. A success is a `PlanApplied`, `{ ok: true, plan, minted, dropped }`. `minted` lists the ids made for new items. `dropped` lists the steps that lost their state when they got their first sub-step.

## The operations

| `op`     | Fields                                                                    | Does                                                                             |
| -------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `set`    | `ids`, `state`; optional `note`, `next`                                   | Sets the state of leaf steps. `next` marks one more step active.                 |
| `note`   | `id`, `text`                                                              | Writes the note of a step. An empty text clears it.                              |
| `unlock` | `ids`, or `'all'`                                                         | Makes every step only the agent checks, in those subtrees, a step anyone checks. |
| `add`    | `type`, `title`; optional `id`, `description`, `checks`, `under`, `after` | Adds a section, text block or step.                                              |
| `edit`   | `id`; optional `title`, `description`, `checks`                           | Changes an item. An empty description removes it.                                |
| `move`   | `id`; optional `under`, `after`                                           | Moves an item with everything under it.                                          |
| `remove` | `id`                                                                      | Removes an item with everything under it.                                        |
| `meta`   | Optional `title`, `summary`, `status`, `checks`                           | Changes the plan's meta. An empty summary or status removes it.                  |

`under` names the section or step to put an item in, and `after` the item it follows there. Without either the item goes last at the top. With only `after` it goes right after that item. A section only stands at the top, a text block never under a step.

A `set` only takes leaf steps. Several steps may be active at once; `next` does not end the others. When a person sets a step back to `open`, `by` and `at` go away, so a misclick leaves no mark the agent has to respect.

`PlanOpSchema` parses any operation and `PlanPersonOpSchema` only the three a person may send.

## Permissions

A person sends `set`, `note` and `unlock`. The agent sends everything except `unlock`: building the plan is the agent's job, and only a person can lift a lock.

Who may set a step depends on [its checks](/plan/plans#who-checks-a-step):

| Checks   | A person                      | The agent                   |
| -------- | ----------------------------- | --------------------------- |
| `anyone` | Yes                           | Yes, unless a person set it |
| `agent`  | Not until a person unlocks it | Yes, unless a person set it |
| `person` | Yes                           | Never                       |

A state a person set belongs to the person. The agent cannot change it, remove the step or anything holding it, rename it, or give it a first sub-step. Setting the same state again is allowed.

A step only a person checks keeps its title and checks, cannot be removed by the agent, and only takes sub-steps a person checks too. `meta.checks` stays `person` while a step still inherits it. The agent cannot lock a step a person unlocked. Notes, descriptions and moves stay open to the agent.

`canApply(op, actor, plan)` checks the permission for one operation without applying it, to disable a control. It does not check that the result is valid. `canDeletePlan(plan, actor)` refuses an agent that would delete a plan holding a state a person set. Deleting a plan is up to the app.

## Refusals

A refusal is a `PlanRefusal`, `{ ok: false, code, message }`. The message names the item; pass it to the agent so it can correct its next batch. `PlanVerdict` is a refusal or `{ ok: true }`, and `refuse(code, message)` builds one for the app's own checks.

| `PlanRefusalCode`    | When                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| `op-not-allowed`     | The actor may not send this operation, or a person sent `next`             |
| `step-locked`        | A person set a step only the agent checks                                  |
| `person-only`        | The agent touched a step only a person checks                              |
| `set-by-person`      | The agent would change or remove what a person set                         |
| `unlocked-by-person` | The agent tried to lock a step a person unlocked                           |
| `plan-missing-item`  | An id names no item                                                        |
| `plan-not-a-step`    | A step operation named a section or text block                             |
| `plan-parent-state`  | A state was set on, or stored on, a step with sub-steps                    |
| `plan-bad-position`  | `under` or `after` puts an item where it cannot stand                      |
| `duplicate-id`       | An id is taken                                                             |
| `plan-too-deep`      | Steps nest deeper than `PLAN_LIMITS.depth`                                 |
| `plan-too-large`     | The plan holds more items than `PLAN_LIMITS.items`                         |
| `plan-invalid`       | The operations, the draft or the result do not fit the schema              |
| `plan-not-found`     | Not returned by the package: for an app that looks plans up                |
| `too-many-plans`     | Not returned by the package: for an app that limits plans per conversation |

## In a store

Operations carry no base revision, so a store applies each batch to the latest plan inside a transaction, or one queue per plan:

```ts
import { applyPlanOps, refuse, type PlanApplied, type PlanRefusal } from '@adecore/plan';
import type { PlanActor, PlanOp } from '@adecore/plan/protocol';

async function update(id: string, ops: PlanOp[], actor: PlanActor): Promise<PlanApplied | PlanRefusal> {
    return store.transaction(async (latest) => {
        const plan = await latest(id);
        return plan ? applyPlanOps(plan, ops, { actor, now: new Date().toISOString() }) : refuse('plan-not-found', `No plan "${id}"`);
    });
}
```

`store` is the app's storage; it saves `result.plan` only when the result is `ok`. Tell the page after the commit. A custom `mintId` may run for a batch that is refused later, so it must not write anything.
