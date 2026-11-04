# State and progress

## State

A step without sub-steps carries its own `state`, and an absent state is `open`:

| State     | Marker | Means                            |
| --------- | ------ | -------------------------------- |
| `open`    | `[ ]`  | Not started                      |
| `active`  | `[~]`  | Being worked on now              |
| `done`    | `[x]`  | Finished                         |
| `failed`  | `[!]`  | Ran and failed                   |
| `skipped` | `[-]`  | Did not run                      |
| `blocked` | `[?]`  | Waiting on something             |
| `warning` | `[w]`  | Finished, with something to read |
| `info`    | `[i]`  | Finished, with a remark          |

The markers are the ones [Markdown](/plan/markdown) and the [text for an agent](/plan/agent-text) use. Several steps may be active at once.

## A parent's state

A step with sub-steps has no state of its own. `stepState(step)` derives it from its children, by the first row that matches:

| Children                           | Parent                                      |
| ---------------------------------- | ------------------------------------------- |
| One failed                         | `failed`                                    |
| One blocked                        | `blocked`                                   |
| All done, skipped, warning or info | `warning` if one has a warning, else `done` |
| One active, done, warning or info  | `active`                                    |
| Otherwise                          | `open`                                      |

A skipped step next to open ones leaves the parent open. On a leaf step, `stepState` returns its `state`, or `open` when it has none, so call it on any step:

```ts
import { allSteps, stepState } from '@adecore/plan';

const failed = allSteps(plan.items).filter((step) => stepState(step) === 'failed');
```

When a step gets its first sub-step, its own state goes away. [Operations](/plan/operations) report those steps in `dropped`.

## Progress

`planProgress(items)` returns a `PlanProgress` that counts the leaf steps under some items: `total`, one count per state, and `finished`, which is done, failed, skipped, warning and info together. It leaves out sections, text and parent steps. Pass a section's items for the progress of one section:

```ts
import { findItem, planProgress } from '@adecore/plan';

const section = findItem(plan, 'prepare');
const progress = section?.type === 'section' ? planProgress(section.items) : null;
```

`progressText(plan)` puts the progress of the whole plan in words:

```
3 of 5 done, 1 with a warning, 1 blocked        (kind: steps)
4 of 6 run, 2 passed, 1 warning, 1 failed       (kind: test)
```

In a `steps` plan a warning or info counts as done. In a `test` plan only `done` counts as passed, and a failed step has run.
