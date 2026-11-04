# Reference

```ts
import { applyPlanOps, createPlan, validatePlan } from '@adecore/plan';
import type { Plan, PlanActor, PlanOp } from '@adecore/plan/protocol';
```

## Schemas

On `@adecore/plan/protocol`. They drop keys they do not know.

| Schema                | Type            | Schema               | Type           |
| --------------------- | --------------- | -------------------- | -------------- |
| `PlanSchema`          | `Plan`          | `PlanOpSchema`       | `PlanOp`       |
| `PlanMetaSchema`      | `PlanMeta`      | `PlanPersonOpSchema` | `PlanPersonOp` |
| `PlanItemSchema`      | `PlanItem`      | `PlanSetOpSchema`    | `PlanSetOp`    |
| `PlanSectionSchema`   | `PlanSection`   | `PlanNoteOpSchema`   | `PlanNoteOp`   |
| `PlanTextSchema`      | `PlanText`      | `PlanUnlockOpSchema` | `PlanUnlockOp` |
| `PlanStepSchema`      | `PlanStep`      | `PlanAddOpSchema`    | `PlanAddOp`    |
| `PlanIdSchema`        | `PlanId`        | `PlanEditOpSchema`   | `PlanEditOp`   |
| `PlanItemIdSchema`    | `PlanItemId`    | `PlanMoveOpSchema`   | `PlanMoveOp`   |
| `PlanStepStateSchema` | `PlanStepState` | `PlanRemoveOpSchema` | `PlanRemoveOp` |
| `PlanChecksSchema`    | `PlanChecks`    | `PlanMetaOpSchema`   | `PlanMetaOp`   |
| `PlanActorSchema`     | `PlanActor`     |                      |                |
| `PlanKindSchema`      | `PlanKind`      |                      |                |

On `@adecore/plan`, the strict [draft](/plan/drafts) schemas: `PlanDraftMetaSchema`, `PlanDraftSectionSchema`, `PlanDraftTextSchema` and `PlanDraftStepSchema`.

## Where each subject lives

| Subject                                   | Page                                    |
| ----------------------------------------- | --------------------------------------- |
| `PLAN_LIMITS`                             | [Plans](/plan/plans#ids-and-limits)     |
| States and their markers                  | [State and progress](/plan/state#state) |
| The eight operations and `PlanRefusalCode` | [Operations](/plan/operations)         |
| Who may set which step                    | [Permissions](/plan/permissions)        |
| `PlanTextOptions`                         | [Text for an agent](/plan/agent-text#options) |

## Exports

Every name each entry point exports, read from its source. Anything not listed is internal and may change in any release.

### `@adecore/plan`

Creating, validating and changing plans, permissions, the tree helpers, Markdown and text.

<ExportTable entry="@adecore/plan" />

### `@adecore/plan/protocol`

The schemas and types of a plan and its operations, and `PLAN_LIMITS`.

<ExportTable entry="@adecore/plan/protocol" />
