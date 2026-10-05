# API reference

`@adecore/plan` exports creation, operations, permission checks, traversals and formatters. Persisted/operation schemas are on [the protocol entry point](./protocol). Calls are synchronous and perform no I/O; id generation uses Web Crypto on demand.

## Creation and validation

| Export              | Inputs and result                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `PlanCreateOptions` | Required `id`, `now`; optional `mintId`, `meta` override for title/kind/checks                |
| `PlanApplyOptions`  | Required `actor`, `now`; optional `mintId`                                                    |
| `PlanApplied`       | `{ ok: true; plan: Plan; minted: string[]; dropped: string[] }`                               |
| `randomItemId`      | `(): string`; six lowercase letter/digit characters                                           |
| `parsePlanDraft`    | `(value: unknown): { ok: true; draft: PlanDraft } \| PlanRefusal`                             |
| `createPlan`        | `(draft: PlanDraft, options: PlanCreateOptions): PlanApplied \| PlanRefusal`                  |
| `validatePlan`      | `(value: unknown): { ok: true; plan: Plan } \| PlanRefusal`                                   |
| `applyPlanOps`      | `(plan: Plan, ops: readonly PlanOp[], options: PlanApplyOptions): PlanApplied \| PlanRefusal` |

Strict draft exports are `PlanDraftStepSchema`/`PlanDraftStep`, `PlanDraftTextSchema`/`PlanDraftText`, `PlanDraftSectionSchema`/`PlanDraftSection`, `PlanDraftItemSchema`/`PlanDraftItem`, `PlanDraftMetaSchema`/`PlanDraftMeta` and `PlanDraftSchema`/`PlanDraft`. Draft ids are optional. Drafts exclude host attribution and unlock fields. Creation requires a title and defaults kind/checks to `steps`/`anyone`; options metadata wins over draft metadata.

See [operations](./operations#atomic-batches) for revision behavior and id-minter exceptions.

## Permissions and refusals

| Export             | Inputs and result                                                               |
| ------------------ | ------------------------------------------------------------------------------- |
| `PlanRefusalCode`  | Stable refusal union; [code reference](./operations#refusal-reference)          |
| `PlanRefusal`      | `{ ok: false; code: PlanRefusalCode; message: string }`                         |
| `PlanVerdict`      | `{ ok: true } \| PlanRefusal`                                                   |
| `refuse`           | `(code: PlanRefusalCode, message: string): PlanRefusal`                         |
| `canApply`         | `(op: PlanOp, actor: PlanActor, plan: Plan): PlanVerdict`                       |
| `canDeletePlan`    | `(plan: Plan, actor: PlanActor): PlanVerdict`                                   |
| `effectiveChecks`  | `(plan: Pick<Plan, 'meta'>, step: PlanStep): PlanChecks`                        |
| `holdsPersonState` | `(item: PlanItem): boolean`; checks its subtree                                 |
| `structureProblem` | `(plan: Pick<Plan, 'items'>): PlanRefusal \| null`; typed whole-tree rules only |

Permission checks do not authenticate actors. `structureProblem` expects schema-valid types; use `validatePlan` for unknown input.

## Tree and progress

| Export              | Inputs and result                                                                       |
| ------------------- | --------------------------------------------------------------------------------------- |
| `PlanLocation`      | `{ item; siblings: PlanItem[]; index; parent: PlanSection \| PlanStep \| null; depth }` |
| `locateItem`        | `(plan: Pick<Plan, 'items'>, id: string): PlanLocation \| null`                         |
| `findItem`          | `(plan: Pick<Plan, 'items'>, id: string): PlanItem \| null`                             |
| `allItems`          | `(items: readonly PlanItem[]): PlanItem[]`; parent-before-child document order          |
| `allSteps`          | `(items: readonly PlanItem[]): PlanStep[]`                                              |
| `isParentStep`      | `(step: PlanStep): boolean`; nonempty children                                          |
| `leafSteps`         | `(items: readonly PlanItem[]): PlanStep[]`                                              |
| `activeStepIds`     | `(plan: Pick<Plan, 'items'>): string[]`; explicitly active leaves                       |
| `isFinishedOutcome` | `(state: PlanStepState): boolean`; done/skipped/warning/info                            |
| `deriveState`       | `(states: readonly PlanStepState[]): PlanStepState`                                     |
| `stepState`         | `(step: PlanStep): PlanStepState`; recursive parent state                               |
| `PlanProgress`      | Counts for total, each state and finished                                               |
| `planProgress`      | `(items: readonly PlanItem[]): PlanProgress`; leaves only                               |

Locations and traversal results reference original items, not deep clones. Do not mutate them to bypass operation permissions. Location depth is one for a top-level/section leaf step and zero for section/text items.

## Formats

| Export               | Inputs and result                                                   |
| -------------------- | ------------------------------------------------------------------- |
| `planToMarkdown`     | `(plan: Plan): string`                                              |
| `parsePlanMarkdown`  | `(markdown: string): { ok: true; draft: PlanDraft } \| PlanRefusal` |
| `PLAN_STATE_MARKERS` | `Record<PlanStepState, string>`                                     |
| `PLAN_LEGEND`        | English marker legend string                                        |
| `PlanTextOptions`    | Optional related `others` and `formatTime: (at: string) => string`  |
| `progressText`       | `(plan: Pick<Plan, 'meta' \| 'items'>): string`                     |
| `renderPlanText`     | `(plan: Plan, options?: PlanTextOptions): string`                   |

See [format fidelity](./formats) before treating Markdown as a persistence format. Sources: [apply](https://github.com/basmilius/adecore/blob/main/packages/plan/src/apply.ts), [permissions](https://github.com/basmilius/adecore/blob/main/packages/plan/src/permissions.ts), [tree](https://github.com/basmilius/adecore/blob/main/packages/plan/src/tree.ts), [Markdown](https://github.com/basmilius/adecore/blob/main/packages/plan/src/markdown.ts) and [text](https://github.com/basmilius/adecore/blob/main/packages/plan/src/text.ts).
