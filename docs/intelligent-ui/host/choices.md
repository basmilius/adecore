# Choices

A Choice is the one way a block talks back. A person picks it, and its context goes to the agent as their next message. The host makes sure the person saw that message, and that a block answers once.

## The flow

1. A person picks a Choice. The page sends `chat.uiChoice` with `chatId`, `itemId`, `blockId`, `revision`, `choiceId`, the block's input values from `uiInputValues`, and for a live block the read ids of the values on screen.
2. The backend finds the stored block at that revision. A reply that still streams, a subagent's reply or a changed block answers `stale-ui-block`.
3. It checks the block was not answered. A second pick of the same Choice answers what the first did; another Choice gets `ui-already-answered`.
4. It runs `resolveUiChoice(block, choiceId, values, queries)`.
5. It sends the selection's `context` as the next message, or queues it behind a running turn, and records the answer.

With `@adecore/agents`, `ChatCore.choose` does all of this behind the agent host's `chat.uiChoice` handler, which answers only a client attached to the chat.

## resolveUiChoice

```ts
import { resolveUiChoice } from '@adecore/intelligent-ui/runtime';

const { label, context, values } = resolveUiChoice(storedBlock, payload.choiceId, payload.values ?? {}, issuedQueryValues);
```

It evaluates the stored block with the submitted values and returns a `UiChoiceSelection`:

| Field     | Holds                                                          |
| --------- | -------------------------------------------------------------- |
| `label`   | The Choice's text, on one line                                 |
| `context` | Its evaluated `context`, or the label when it has none         |
| `values`  | The input values the message was evaluated with                |

It throws a `UiFailure` with one of these codes:

| Code               | Cause                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| `refused_choice`   | The block is unfinished or of another catalog version; the Choice is not there, hidden, disabled, outside `Choices`, or has no readable label |
| `refused_binding`  | A submitted name is not a declared input of the block                   |
| `invalid_value`    | A value no visible control could have produced, or of another type      |
| `budget_exceeded`  | Evaluating the block ran out of budget                                  |

`uiChoiceLabel(node)` returns the label an evaluated Choice would send, or `null` when the host would refuse it: the node failed or never closed, or its label is empty or unreadable. A page never draws a `null` Choice as pressable.

The fourth argument holds query values from the caller's own readings; the client's input map can never set a query.

## What a person could have set

`uiInputValues(block, state)` lists the values of every variable a complete control binds or a Button action targets. A page sends that.

A submitted value is accepted when it equals the default, when a visible complete control holds it within its options (a Segmented value one of its Options, a Checklist value made of its Items), or when a visible enabled Button sets exactly that value. A control inside a false `Show` is not visible and vouches for nothing.

`uiValidatedState(block, input, queries?, limits?)` applies the same check and returns a `UiState`. Queries and links use it before they evaluate client input.

## Live blocks

For a block with queries, the backend accepts only readings it issued itself:

- The page sends `reads`, the read id of each reading on screen.
- For every declared query, the read id must name a reading the backend issued for the current arguments and still holds, or the frozen first reading while the arguments are the defaults.
- Otherwise the choice is refused with `stale-ui-query` and the code `stale-read`. The page reads again and reopens the choices.

The page closes choices while a block reads and while a changed input awaits its read. `uiLiveChoiceReason` in agents-react says why.

## Answers

The backend records the answer on the assistant item as `uiAnswers[blockId]`, a `ChatUiAnswer`: the identities, `label`, `values`, `sourceAt`, `older` (whether a newer reply had come), `at`, `queued` and `turnId`. The user message carries the same origin as `uiChoice`. The message is logged before the answer, so a crash cannot send it twice.

A page draws an answered block with its answer's label and time, and closes every input and Choice. The sent values stay, after a reload too. `ChatHost.intelligentUi.sendChoice` resolves `sent` or `queued`; without it, choices stay closed.
