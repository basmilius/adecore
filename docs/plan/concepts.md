# Tree, state and progress

## Stored structure

A `Plan` has `id`, nonnegative integer `rev`, string `createdAt`, `meta` and `items`. Metadata contains a nonempty title, `kind: 'steps' | 'test'`, required default `checks`, optional summary and optional status.

Top-level items may be sections, text blocks or steps. Sections contain text and steps and cannot nest. Steps may contain steps only. Text has no children. Ids are unique across all items within a plan; sections count toward the 300-item limit. Step nesting is at most five levels, counting the first step as level one even inside a section.

`validatePlan` checks the schema and whole-tree invariants. Parsing `PlanSchema` alone does not check duplicate ids, depth, count or a parent's state fields. Persisted schemas strip unknown fields; drafts are strict. See [Plan protocol](./protocol) for field limits.

## Leaf state and attribution

A leaf's absent `state` reads as `open`. A parent with nonempty `steps` has no stored `state`, `by` or `at`; its state follows its children. Empty `steps: []` does not make a parent, and successful operations prune that empty field.

Host-applied state changes set `by: 'person' | 'agent'` and `at` from the host's `now`. Creation attributes explicit initial states to the agent. Adding a new step without state leaves it open without attribution.

A person setting a leaf back to `open` removes `by` and `at`, so correcting a click does not leave protected person state. An agent repeating the exact state a person set preserves that person's attribution. Adding the first sub-step removes the former leaf's state and attribution; the accepted result reports its id in `dropped` when it had a stored state. A person-set leaf cannot undergo that conversion.

Stored timestamps are strings, not date-refined schemas. Supply valid ISO times at trusted host boundaries. Validation establishes structure, not the authenticity of an attribution supplied in persisted JSON.

## Check ownership

`effectiveChecks(plan, step)` uses the following precedence:

1. `unlocked: true` makes the step `anyone`.
2. A step's explicit `checks` wins over plan metadata.
3. Otherwise use `plan.meta.checks`.

Check ownership does not inherit from a parent step. A child without its own `checks` still uses the plan metadata. A person's unlock marks existing agent-only steps in the selected subtree; it does not set a policy on future children.

The core's person and agent roles describe allowed operations, not authentication. The host chooses a role from a verified session. [Operations and permissions](./operations) describes the refusals that follow.

## Derived state

`stepState` recursively derives a parent from child states using `deriveState`:

| Condition, in precedence order                  | Parent state                               |
| ----------------------------------------------- | ------------------------------------------ |
| Any child failed                                | `failed`                                   |
| Any child blocked                               | `blocked`                                  |
| All children are done, skipped, warning or info | `warning` if any warning; otherwise `done` |
| Any child is active, done, warning or info      | `active`                                   |
| Otherwise                                       | `open`                                     |

A skipped child alongside open children leaves the parent open. An info outcome stays visible on its leaf but does not make the completed parent `info`. Warnings bubble upward. `deriveState([])` returns `done` through its all-finished rule; an actual empty step is a leaf and reads its own state instead.

## Progress

`leafSteps` and `planProgress` count leaf steps in document order. Parent headings, text and sections do not inflate totals. Progress contains a count for each state and a `finished` count.

`isFinishedOutcome` returns true for done, skipped, warning and info. `planProgress.finished` also includes failed because it is a completed attempt. Blocked and active remain unfinished. This distinction lets a test plan report how many ran without describing failures as passed.

```ts
import { deriveState, planProgress, progressText } from '@adecore/plan';
import type { Plan } from '@adecore/plan/protocol';

const plan: Plan = {
    id: 'checks',
    rev: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    meta: { title: 'Checks', kind: 'test', checks: 'anyone' },
    items: [
        {
            type: 'step',
            id: 'suite',
            title: 'Suite',
            steps: [
                { type: 'step', id: 'one', title: 'First', state: 'done' },
                { type: 'step', id: 'two', title: 'Second', state: 'warning' },
                { type: 'step', id: 'three', title: 'Third', state: 'blocked' }
            ]
        }
    ]
};
console.log(deriveState(['done', 'warning', 'blocked']));
console.log(planProgress(plan.items));
console.log(progressText(plan));
```

The parent is blocked; two of the three leaves are finished. `progressText` reports test run/pass counts for `kind: 'test'` and done counts for `kind: 'steps'`. `activeStepIds` reports explicitly active leaves, not parents whose derived state is active.
