# Integration, migration and testing

## Trusted host inputs

The core does not authenticate a person or agent. Supply `actor` from verified host context, not from a caller-selected JSON field. Supply `now` from the host clock and validate a stored plan before applying updates. Do not accept an agent draft as persisted `Plan` JSON with trusted attribution.

Draft parsing is strict. Creation accepts optional ids, requires a title and applies host title/kind/checks overrides before validating the result. It mints missing ids, preserves explicit ones and rejects initial states on person-only steps. Inject `mintId` when the host needs deterministic ids or lacks Web Crypto.

Permission checks protect the rules described by this package. They do not implement project access, collection ownership, arbitrary approval gates or filesystem security. Apply those policies before calling the core. Whole-plan deletion must use the host's authorization and `canDeletePlan` where person-state protection applies.

## Persist the latest plan atomically

Operations name items rather than a base revision. This avoids making a click stale solely because another actor updated an unrelated item, but it requires a host transaction or per-plan serialization. Read the latest plan, apply the entire batch and persist only a successful result under one lock/transaction.

The following is a host-provided adapter contract, not an Adecore export. Its `update` implementation must serialize callbacks per id and commit only successful results. The callback performs no I/O.

```ts
import { applyPlanOps, refuse } from '@adecore/plan';
import type { PlanApplied, PlanRefusal } from '@adecore/plan';
import type { Plan, PlanActor, PlanOp } from '@adecore/plan/protocol';

interface PlanStore {
    update(id: string, change: (latest: Plan | null) => PlanApplied | PlanRefusal): Promise<PlanApplied | PlanRefusal>;
}

function applyStoredBatch(store: PlanStore, id: string, ops: readonly PlanOp[], trustedActor: PlanActor, now: string): Promise<PlanApplied | PlanRefusal> {
    return store.update(id, (latest) => {
        if (latest === null) {
            return refuse('plan-not-found', `No plan named "${id}"`);
        }
        return applyPlanOps(latest, ops, { actor: trustedActor, now });
    });
}
```

Never replace storage with a stale client snapshot after applying a batch elsewhere. Publish changed events only after commit. If a save fails, return a host storage error and retain the previous state; the core's successful return is not proof of persistence.

There is no event subscription, async resource or disposal method in the core. Hosts own transactions, subscriptions, UI optimistic state and reconciliation after a refusal.

## Protocol composition and migration

1. Replace behavioral imports with `@adecore/plan` and generic schemas with `@adecore/plan/protocol`.
2. Compose identity associations, list/apply payloads and created/changed/removed events in the host. Preserve serialized fields and wire-table order.
3. Preserve revisions, ids, actor attribution, unlock flags, optional-field omission and refusal codes. Do not rewrite persisted data merely because a package name changed.
4. Enforce the host's related-plan collection limit using the retained `PLAN_LIMITS.plansPerChat` compatibility value if that matches existing policy.
5. Compare permission, persisted JSON, generated-client and optimistic-update fixtures before replacing the old implementation. Markdown is not a fidelity-preserving migration path.

The compatibility symbol contains the historical scope wording but no application name. Compact text also retains `Also in this chat` when `others` is supplied. Keep those existing contracts or format host-owned output; the package provides no wording override.

## Checks and troubleshooting

From the repository root:

```sh
bun run --cwd packages/plan typecheck
bun run --cwd packages/plan test
```

Tests cover permission combinations, atomic rollback, unlocks, person-state protection, structural edits, limits, derived progress, draft validation, text and Markdown fixtures. The [standalone example](https://github.com/basmilius/adecore/blob/main/packages/plan/examples/check-plan.ts) runs without storage. Also verify the host's concurrent writes, failed commits, authenticated actor selection and collection authorization. Test both default compiled and linked source imports.

| Symptom                                               | Cause and next step                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| Duplicate ids parse as `PlanSchema`                   | Use `validatePlan` for whole-tree invariants.                                 |
| A person's click returns `step-locked`                | Unlock the agent-only step as a person, then set it.                          |
| An agent repeats a person state but attribution stays | That is deliberate. Repeating the same state preserves the person mark.       |
| A child ignores its parent's checks                   | Check ownership inherits from plan metadata, not parent steps.                |
| Unlock does not affect a later-added child            | Unlock marks existing agent-only steps only.                                  |
| Adding a child removes a leaf state                   | Parents derive state. Inspect the success result's `dropped` ids.             |
| Progress is lower than the number of rows             | It counts leaves; parents, sections and text are not tasks.                   |
| Markdown import loses ids/locks                       | The format intentionally omits them. Use validated JSON for persistence.      |
| `canApply` passes but application refuses             | It checks permission only; positioning and final structure are checked later. |
| Id creation throws after repeated collisions          | Supply a minter that produces free valid ids; retries stop at 1000.           |
