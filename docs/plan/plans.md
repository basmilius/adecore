# Plans

```json
{
    "id": "release",
    "rev": 3,
    "createdAt": "2026-10-05T09:00:00.000Z",
    "meta": { "title": "Ship the release", "kind": "steps", "checks": "anyone" },
    "items": [
        {
            "type": "section",
            "id": "prepare",
            "title": "Prepare",
            "items": [
                { "type": "text", "id": "heads-up", "title": "Heads-up", "description": "A published version cannot be taken back." },
                { "type": "step", "id": "changelog", "title": "Write the changelog", "state": "done", "by": "person", "at": "2026-10-05T09:12:00.000Z" }
            ]
        }
    ]
}
```

A `Plan` has an `id`, a `rev` that every applied batch raises by one, a `createdAt`, its `meta` and its `items`. The schemas and types are on `@adecore/plan/protocol`; the [reference](/plan/reference#schemas) lists them.

`meta` holds the `title`, a `kind` and the default `checks` of its steps, with an optional `summary` and a one-line `status`. The `kind` is `steps` for work to get through, or `test` for a list of checks with outcomes; it changes how [progress](/plan/state#progress) reads.

## Items

| Type      | Stands                                | Holds                 |
| --------- | ------------------------------------- | --------------------- |
| `section` | At the top only; sections do not nest | Text blocks and steps |
| `text`    | At the top or in a section            | Nothing               |
| `step`    | At the top, in a section or in a step | Steps                 |

Every item has an `id`, a `title` and an optional `description`. A step also has optional `checks`, `state`, `note` and `unlocked`, plus `by` and `at` (who set its state last, and when). The app fills `by` and `at` from `actor` and `now`; an agent never writes them. [State and progress](/plan/state) explains `state`, and [Permissions](/plan/permissions) explains `checks` and `unlocked`.

## Ids and limits

Ids are lowercase letters, digits and hyphens, unique across the plan. `PLAN_LIMITS` holds the limits a plan must stay within:

| Key            | Limit | Applies to                                                                    |
| -------------- | ----- | ----------------------------------------------------------------------------- |
| `idLength`     | 64    | Plan and item ids                                                             |
| `title`        | 200   | Every title, at least 1                                                       |
| `description`  | 1000  | Descriptions and the summary                                                  |
| `note`         | 500   | Notes                                                                         |
| `status`       | 200   | The status line                                                               |
| `depth`        | 5     | Steps under steps, counting a top-level step as 1                             |
| `items`        | 300   | Every item in the plan, sections and text included                            |
| `plansPerChat` | 20    | Not checked here; a limit for the app's own list of plans in one conversation |

## Loading a plan

`PlanSchema` checks each item on its own. `validatePlan(value)` also checks the whole tree (unique ids, depth, item count, placement, no state on a parent). It returns `{ ok: true, plan }` or a [refusal](/plan/operations#refusals). Run it on every plan you load:

```ts
import { validatePlan } from '@adecore/plan';

const loaded = validatePlan(JSON.parse(stored));

if (!loaded.ok) {
    throw new Error(`${loaded.code}: ${loaded.message}`);
}
```

A stored plan has no format version. The protocol schemas drop keys they do not know, so a later optional field does not break an older reader.

## Walking the tree

| Function              | Returns                                                   |
| --------------------- | --------------------------------------------------------- |
| `findItem(plan, id)`  | The item, or `null`                                       |
| `allItems(items)`     | Every item, parents before their children                 |
| `allSteps(items)`     | Every step                                                |
| `leafSteps(items)`    | Every step without sub-steps, the ones that carry a state |
| `isParentStep(step)`  | Whether it has sub-steps                                  |
| `activeStepIds(plan)` | The ids of the leaf steps set to `active`                 |

```ts
import { activeStepIds, findItem } from '@adecore/plan';

const now = activeStepIds(plan).map((id) => findItem(plan, id)?.title);
```
