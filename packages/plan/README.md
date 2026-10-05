# @adecore/plan

[![npm](https://img.shields.io/npm/v/@adecore/plan)](https://www.npmjs.com/package/@adecore/plan)
[![Docs](https://img.shields.io/badge/docs-adecore.dev-blue)](https://adecore.dev/plan/)

A plan that a person and an agent work through together: steps, sub-steps, sections and notes, with rules for who may check what. Every change is a batch of operations that applies as a whole or is refused with a code and a reason. Plans read and write as a Markdown task list. No storage, no clock and no UI: the app brings those.

**[Documentation with live demos](https://adecore.dev/plan/)**

## Install

```sh
bun add @adecore/plan
```

## Use

```ts
import { applyPlanOps, createPlan, parsePlanMarkdown } from '@adecore/plan';

const parsed = parsePlanMarkdown('# Ship the release\n\n- [ ] Run the tests\n');
const created = parsed.ok ? createPlan(parsed.draft, { id: 'release', now: new Date().toISOString() }) : parsed;

if (created.ok) {
    const [step] = created.minted;
    const result = applyPlanOps(created.plan, [{ op: 'set', ids: [step!], state: 'done' }], {
        actor: 'person',
        now: new Date().toISOString()
    });
}
```

## Entry points

| Import | What it holds |
|---|---|
| `@adecore/plan` | Creating, validating and changing plans, permissions, progress, Markdown and text |
| `@adecore/plan/protocol` | The Zod schemas and types of a plan and its operations |

## Documentation

| Page | What it covers |
|---|---|
| [Plans](https://adecore.dev/plan/plans) | The tree, states, progress and creating a plan |
| [Operations](https://adecore.dev/plan/operations) | `applyPlanOps`, permissions, refusals and a store |
| [Markdown and text](https://adecore.dev/plan/markdown) | The Markdown format and the text an agent reads |

## License

FSL-1.1-MIT, see [LICENSE](./LICENSE).
