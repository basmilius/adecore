# Plan protocol

Import persisted schemas and operation types from `@adecore/plan/protocol`. Strict draft schemas and behavioral validation remain on the root entry point. The protocol defines a single plan and its generic operations; the host owns collections, identity scopes, requests and lifecycle events.

## Persisted fields and limits

`PlanSchema` requires `id`, nonnegative integer `rev`, string `createdAt`, `meta` and `items`. There is no plan document-version field or migration function. `createdAt` and step `at` are strings without date-format refinement.

`PlanItemIdSchema` and `PlanIdSchema` require 1 through 64 lowercase letters, digits or hyphens, using `^[a-z0-9-]+$`. They do not require a UUID or randomness.

| `PLAN_LIMITS` key | Value | Enforcement                                              |
| ----------------- | ----- | -------------------------------------------------------- |
| `idLength`        | 64    | Id schema                                                |
| `title`           | 200   | Nonempty title schemas                                   |
| `description`     | 1000  | Description/summary schemas                              |
| `note`            | 500   | Note schemas                                             |
| `status`          | 200   | Metadata status schema                                   |
| `depth`           | 5     | `validatePlan` whole-tree check                          |
| `items`           | 300   | `validatePlan` whole-tree check, including sections/text |
| `plansPerChat`    | 20    | Compatibility constant; host collection check            |

The historical `plansPerChat` key stays available without introducing a collection schema or ownership model. Enforce it in the host's related-plan scope.

State order is `open`, `active`, `done`, `failed`, `skipped`, `blocked`, `warning`, `info`. Checks are `anyone`, `agent`, `person`; actors are `person`, `agent`; kinds are `steps`, `test`. Preserve enum order for generated clients. Missing leaf state and step checks remain absent; behavior resolves them to open and plan checks. Unlock overrides check ownership.

Unknown fields in persisted and operation objects are stripped. Strict agent drafts reject misspelled fields, `by`, `at` and `unlocked`. Whole-tree duplicate, nesting, depth, count and parent-state rules need `validatePlan`, not `PlanSchema.parse` alone.

## Operation shapes

| Op       | Required                  | Optional                                        |
| -------- | ------------------------- | ----------------------------------------------- |
| `set`    | Nonempty `ids`, `state`   | `note`, agent-only `next`                       |
| `note`   | `id`, `text`              | None                                            |
| `unlock` | Nonempty `ids` or `'all'` | None                                            |
| `add`    | `type`, `title`           | `id`, `description`, `checks`, `under`, `after` |
| `edit`   | `id`                      | `title`, `description`, `checks`                |
| `move`   | `id`                      | `under`, `after`                                |
| `remove` | `id`                      | None                                            |
| `meta`   | None beyond `op`          | `title`, `summary`, `status`, `checks`          |

Empty notes, descriptions, summary and status clear optional fields. Empty titles are invalid. `PlanOpSchema` accepts all eight families; `PlanPersonOpSchema` accepts set/note/unlock. These schemas establish shape, not permissions. Atomic batches apply against the latest plan without a base revision and increment `rev` once.

## Export reference

Every schema below has a matching inferred type named by removing `Schema`:

- `PlanItemIdSchema`, `PlanIdSchema`
- `PlanStepStateSchema`, `PlanChecksSchema`, `PlanActorSchema`, `PlanKindSchema`
- `PlanMetaSchema`, `PlanStepSchema`, `PlanTextSchema`, `PlanSectionSchema`, `PlanItemSchema`, `PlanSchema`
- `PlanSetOpSchema`, `PlanNoteOpSchema`, `PlanUnlockOpSchema`, `PlanAddOpSchema`, `PlanEditOpSchema`, `PlanMoveOpSchema`, `PlanRemoveOpSchema`, `PlanMetaOpSchema`
- `PlanPersonOpSchema`, `PlanOpSchema`

The inferred exports are `PlanItemId`, `PlanId`, `PlanStepState`, `PlanChecks`, `PlanActor`, `PlanKind`, `PlanMeta`, `PlanStep`, `PlanText`, `PlanSection`, `PlanItem`, `Plan`, `PlanSetOp`, `PlanNoteOp`, `PlanUnlockOp`, `PlanAddOp`, `PlanEditOp`, `PlanMoveOp`, `PlanRemoveOp`, `PlanMetaOp`, `PlanPersonOp` and `PlanOp`. `PLAN_LIMITS` is the remaining protocol export.

Sections live only at the top and contain text/steps. Steps contain steps. Parent state/attribution is prohibited by whole-tree validation. See [Tree, state and progress](./concepts) and [Operations and permissions](./operations) for behavior.
