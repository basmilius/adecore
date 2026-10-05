# @adecore/plan

A plan is a tree of steps, top-level sections and text blocks. The package validates stored data, creates plans from strict drafts, applies atomic operation batches under person or agent permissions, derives progress and exports Markdown or compact reading text.

The core has no storage, transport or UI dependency. The host authenticates actors, supplies timestamps and serializes changes against the latest stored plan. Permission refusals are data that a host can present or return to a caller.

The package is private at `0.0.0` pending initial publication. Transferred code retains [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/plan/LICENSE); Zod is its declared runtime dependency. Default imports use `dist`, while the `source` condition reads TypeScript.

## Read the documentation

- [Getting started](./getting-started) creates a plan and demonstrates accepted and refused updates.
- [Tree, state and progress](./concepts) explains structure, attribution, check ownership and derived state.
- [Operations and permissions](./operations) covers batches, positioning, unlocks and person-state protection.
- [Markdown and reading text](./formats) explains import/export fidelity and output options.
- [API reference](./api) groups every behavioral export.
- [Plan protocol](./protocol) covers stored schemas, operation shapes and limits.
- [Integration, migration and testing](./migration) covers trusted host inputs, persistence and troubleshooting.

The [standalone example](https://github.com/basmilius/adecore/blob/main/packages/plan/examples/check-plan.ts) imports a task list and checks a step. Plans model steps and test outcomes. Timed storyboards, creative variants or approval workflows need their own schemas and permission rules.
