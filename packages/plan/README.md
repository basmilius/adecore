# @adecore/plan

Plan schemas, strict drafts, atomic tree operations, person/agent permissions, progress and Markdown/reading output. The core depends on Zod and owns no store, transport or UI.

The package is private at `0.0.0` pending initial publication. Use the local checkout with `source` conditions or build JavaScript/declarations in `dist` for default imports. Transferred code retains FSL-1.1-MIT in [LICENSE](./LICENSE).

```ts
import { applyPlanOps, createPlan, parsePlanMarkdown } from '@adecore/plan';

const parsed = parsePlanMarkdown('# Delivery\n\n- [ ] Review the result\n');
if (!parsed.ok) {
    throw new Error(parsed.message);
}
const created = createPlan(parsed.draft, {
    id: 'delivery',
    now: '2026-01-01T00:00:00.000Z',
    mintId: () => 'review'
});
if (!created.ok) {
    throw new Error(created.message);
}
const checked = applyPlanOps(created.plan, [{ op: 'set', ids: ['review'], state: 'done' }], {
    actor: 'person',
    now: '2026-01-01T00:01:00.000Z'
});
if (!checked.ok) {
    throw new Error(checked.message);
}
```

The host supplies authenticated actors and time, applies batches to the latest stored plan and persists successful results atomically. Refusals leave input unchanged. Parents derive state; unlocks and person-set state survive updates. Markdown omits ids, attribution and checks, so persist validated JSON for full fidelity.

Read the [overview](https://adecore.dev/plan/), [getting started](https://adecore.dev/plan/getting-started), [tree/progress concepts](https://adecore.dev/plan/concepts), [operations guide](https://adecore.dev/plan/operations), [format guide](https://adecore.dev/plan/formats), [API reference](https://adecore.dev/plan/api), [protocol](https://adecore.dev/plan/protocol) and [integration/testing guide](https://adecore.dev/plan/migration).

From the repository root, run `bun run --cwd packages/plan test`, `typecheck` or `build`. The [standalone example](./examples/check-plan.ts) imports, checks and exports a task list.
