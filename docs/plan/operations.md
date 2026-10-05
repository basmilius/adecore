# Operations and permissions

## Atomic batches

`applyPlanOps(plan, ops, { actor, now, mintId? })` parses a nonempty operation array, clones the plan and applies operations sequentially. Each operation sees the previous operation's result. On success it prunes empty child arrays, increments `rev` once and validates the whole result. It returns `{ ok: true, plan, minted, dropped }`.

Any refusal returns `{ ok: false, code, message }` and leaves the original plan unchanged. Structural depth and count checks happen on the final result, while per-operation permission and positioning checks happen during application. The host should supply an already-validated latest plan. The core does not fetch it or accept a base revision.

Even an accepted operation that repeats a state produces a new batch revision. A failed batch can still call the injected id minter before its refusal; keep that adapter free of persistence side effects. Collision retries stop after 1000 attempts and throw an error rather than returning a refusal. Custom minters must return valid ids; final validation catches invalid generated ids.

## Allowed operation families

| Operation | Person                 | Agent                                  | Main behavior                                                     |
| --------- | ---------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| `set`     | Yes, subject to checks | Yes, subject to checks/person state    | Set one or more leaf states; optional note                        |
| `note`    | Yes                    | Yes                                    | Write or clear a step note, including on a parent                 |
| `unlock`  | Yes                    | No                                     | Permanently unlock existing agent-only steps in selected subtrees |
| `add`     | No                     | Yes                                    | Insert a section, text or step                                    |
| `edit`    | No                     | Yes, subject to protection             | Change title, description or step checks                          |
| `move`    | No                     | Yes, subject to destination protection | Relocate an existing item/subtree                                 |
| `remove`  | No                     | Yes, subject to protection             | Remove an item/subtree                                            |
| `meta`    | No                     | Yes, subject to person-only defaults   | Edit title, summary, status or default checks                     |

`canApply` previews permission against a typed operation and current plan. It does not parse the operation, validate its final position or promise that a whole batch succeeds. Always use `applyPlanOps` for the final decision. `PlanPersonOpSchema` narrows the operation family but still needs permission checks; it shares the `set` shape, including the agent-only `next` field that application rejects for a person.

## Setting, notes and unlocks

State changes target leaves. Setting a section/text fails with `plan-not-a-step`; setting a parent fails with `plan-parent-state`. A person cannot set an agent-only leaf until it is unlocked. An agent cannot set a person-only leaf or change a different state last set by a person.

An agent's `set.next` activates another leaf in the same revision. Both the state targets and `next` pass the same permission checks. The operation does not deactivate unrelated active steps; multiple active leaves are allowed. A person cannot send `next`.

`set.note` applies the same note to each targeted leaf. A separate `note` can annotate any step regardless of check policy or person-set state. Empty note text removes the note.

`unlock` accepts a nonempty step-id array or `'all'`. It traverses each selected subtree, marking only steps whose effective checks are currently agent-only. Person-only steps remain person-only. The agent cannot relock an unlocked step, even by editing its stored `checks`; `unlocked` wins during resolution.

## Positioning and structural edits

For `add` and `move`, absent `under` and `after` mean append at the top. `under` selects a section or step container; `after` chooses a sibling in that container. With only `after`, the item goes beside that item in its current container. If both are supplied, `after` must be directly under `under`.

Sections can stand only at the top. Text can stand at the top or inside a section. Steps can stand at the top, in a section or under a step. An item cannot move into itself or a descendant, or after itself. Missing ids are refused; failed moves cannot remove anything from the input plan.

Missing `add.id` is minted; supplied duplicates are refused. `checks` belongs only to a step, so adding/editing checks on text or a section is invalid. Adding the first child to a leaf clears its leaf attribution and returns its id in `dropped` if it had state. Removing the last child leaves an open leaf after empty-array pruning.

Empty descriptions, summary and status clear those optional fields. Missing edit fields leave the corresponding values unchanged. Operation objects strip unknown keys; use a stricter host request schema if accidental extra fields must be refused.

## Protecting a person's decision

An agent cannot change a person's state, change the title of a step containing person-set state, remove an item containing person-set state or turn a person-set leaf into a parent. Repeating a person's exact state preserves attribution and is allowed when effective checks permit the agent to set it.

A person-only step's title and check ownership are protected even before anyone sets its state. Removing it or an ancestor is refused. Changing metadata away from a person-only default is refused while any locked step inherits that default.

Descriptions, notes and moves have different rules from titles and removal. For example, an agent can move a checked subtree if the destination does not erase another protected leaf state. A host that needs broader approval or immutability rules must add them explicitly.

`canDeletePlan(plan, actor)` protects whole-plan deletion from an agent only when the plan holds person-set state. It does not refuse deletion solely because an unset leaf is person-only. Collection access and deletion authorization remain host responsibilities.

## Refusal reference

| Code                              | Meaning                                                          |
| --------------------------------- | ---------------------------------------------------------------- |
| `person-only`                     | Operation would bypass person-only checks or protected ownership |
| `set-by-person`                   | Operation would change or remove a person's state/meaning        |
| `unlocked-by-person`              | Agent tried to relock a person's unlock                          |
| `step-locked`                     | Person tried to set an agent-only step before unlocking          |
| `op-not-allowed`                  | Actor cannot use this operation or `next`                        |
| `plan-missing-item`               | Named item does not exist                                        |
| `plan-not-a-step`                 | A step-only operation targeted another kind                      |
| `plan-parent-state`               | Parent state was supplied or directly targeted                   |
| `plan-bad-position`               | Invalid parent/sibling relationship or self move                 |
| `duplicate-id`                    | An item id is already taken                                      |
| `plan-too-deep`, `plan-too-large` | Whole-tree depth or item limit exceeded                          |
| `plan-invalid`                    | Schema/draft/batch shape is invalid                              |

`PlanRefusalCode` also includes `plan-not-found` and `too-many-plans` for host-owned lookup/collection refusal paths. The core does not maintain a collection that could emit them by itself. `refuse(code, message)` builds the common shape.
