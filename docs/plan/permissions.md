# Permissions

A plan has two actors, `person` and `agent`. The package trusts the `actor` it is given, so the app takes it from a verified session, never from the request body.

## Who sends which operation

A person sends `set`, `note` and `unlock`. The agent sends everything except `unlock`. Building the plan is the agent's job, and only a person can lift a lock. `PlanPersonOpSchema` parses only the three a person may send, so the app can check a page's request before it reaches `applyPlanOps`.

## Who checks a step

`effectiveChecks(plan, step)` is `anyone`, `agent` or `person`: `anyone` when a person unlocked the step, else the step's own `checks`, else `meta.checks`. A sub-step does not take the checks of the step above it.

Who may set a step depends on its checks:

| Checks   | A person                      | The agent                   |
| -------- | ----------------------------- | --------------------------- |
| `anyone` | Yes                           | Yes, unless a person set it |
| `agent`  | Not until a person unlocks it | Yes, unless a person set it |
| `person` | Yes                           | Never                       |

An `unlock` turns every step only the agent checks, in the named subtrees, into a step anyone checks. `{ op: 'unlock', ids: 'all' }` unlocks the whole plan.

## What a person's check protects

A state a person set belongs to the person. The agent cannot change it, remove the step or anything holding it, rename it, or give it a first sub-step. Setting the same state again is allowed.

The agent cannot remove a step only a person checks, or change its title and checks. Such a step only takes sub-steps a person checks too. `meta.checks` stays `person` while a step still inherits it. The agent cannot lock a step a person unlocked. Notes, descriptions and moves stay open to the agent.

When a person sets a step back to `open`, `by` and `at` go away, so a misclick leaves no mark the agent has to respect.

## Asking before you apply

`canApply(op, actor, plan)` checks the permission for one operation without applying it, to disable a control:

```tsx
import { canApply } from '@adecore/plan';

const verdict = canApply({ op: 'set', ids: [step.id], state: 'done' }, 'person', plan);

<input type="checkbox" disabled={!verdict.ok} />;
```

It returns a `PlanVerdict`: `{ ok: true }` or a [refusal](/plan/operations#refusals) with the reason. It does not check that the result is valid; `applyPlanOps` does that.

`canDeletePlan(plan, actor)` refuses an agent that would delete a plan holding a state a person set, with `set-by-person`. Deleting a plan is up to the app, so call it before you delete.
