# Plan

`@adecore/plan` holds a plan that a person and an agent work through together: steps, sub-steps, sections and notes, with rules for who may check what. The agent builds and updates the plan. The person checks steps off, and what a person checked stays checked. One function applies each batch of operations as a whole, or refuses it with a code and a reason.

<Demo src="canvas/plan-checklist" />

Check steps as a person, then switch to the agent and try again. Typecheck and Tests are the agent's until a person unlocks them, Approve is the person's, and every accepted batch raises `rev` by one. Under the checklist is the plan as `planToMarkdown` writes it.

## What it does

- Validates a plan, and creates one from an agent's draft or from Markdown.
- Applies a batch of eight kinds of operations all or nothing, and refuses with a code and a message the agent can act on.
- Decides per step whether a person, the agent or anyone may check it, and keeps a person's check from being overwritten.
- Derives the state of a parent step from its sub-steps, and counts progress.
- Writes a plan as Markdown, and as compact text with ids for an agent.

Schemas and types are on `@adecore/plan/protocol`; the behavior is on `@adecore/plan`. Both only need Zod. The package has no storage, clock or transport, so it runs the same in a page, a backend and a test.

## What it leaves to the app

- Who is asking. The package trusts `actor` (`person` or `agent`), so take it from a verified session, never from the request body.
- The time. Every call that writes a state takes `now`.
- Storage. Operations name items by id, not a base revision, so a person's click and an agent's update do not conflict. The app applies each batch to the latest stored plan and saves it in one transaction; see [in a store](/plan/operations#in-a-store).

## Where to next

- [Getting started](/plan/getting-started) creates a plan, applies operations as both actors and writes it out.
- [Plans](/plan/plans) describes the tree, its ids and limits, and how to walk it.
- [State and progress](/plan/state) covers the state of a step, of its parent and of the plan.
- [Creating a plan](/plan/drafts) covers drafts and `createPlan`.
- [Operations](/plan/operations) covers `applyPlanOps`, the eight operations and every refusal.
- [Permissions](/plan/permissions) covers who may send which operation and check which step.
- [Markdown](/plan/markdown) covers reading and writing a plan as a task list.
- [Text for an agent](/plan/agent-text) covers the compact text an agent reads.
- [Reference](/plan/reference) lists the schemas and every export.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/plan/LICENSE).
