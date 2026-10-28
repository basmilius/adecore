# Conversation

A chat is a `ChatInfo` and a list of `ChatItem`s. The info says what the chat is and does. The items are its thread.

```ts
import { ChatInfoSchema, ChatItemSchema, type ChatInfo, type ChatItem } from '@adecore/agent-contracts/chat';
```

## ChatInfo

The fields a client reads most:

| Field                                   |                                                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `chatId`                                | Chosen by the client. Any nonempty string.                                                               |
| `provider`, `account`                   | The CLI that answers and its account. No `account` is the CLI's default account.                         |
| `cwd`                                   | The folder the chat works in, on the host's machine.                                                     |
| `selection`, `model`                    | The model and options asked for, and the model the CLI reported. An alias can make them differ.          |
| `runtimeMode`, `effectiveRuntimeMode`   | The permission policy asked for, and the one the running CLI confirmed (absent until then).              |
| `status`                                | `running`, `needs-you`, `idle`, `error` or `exited`.                                                     |
| `running`, `activeTurnId`               | Whether the CLI process is alive, and the turn in flight. A live process can be idle between turns.      |
| `queue`, `queuePaused`                  | Messages sent during a turn, in send order.                                                              |
| `background`, `delegating`              | Shell commands and monitors the CLI keeps running, and whether its own subagent still works.             |
| `requests`                              | The approvals and questions waiting on a person, oldest first, at most `CHAT_REQUEST_LIMITS.perChat`.    |
| `usage`                                 | `ChatUsage`: context tokens, context window, cost, turns and an estimated context `breakdown`. `cacheTtlMs` and `cacheExpiresAt` give the prompt cache lifetime when the CLI reports it. |
| `limit`, `resumeAt`, `resumeAtReset`    | The limit the last turn stopped on, when the host resumes, and the chat's switch for that.               |
| `goal`                                  | `ChatGoal`: the objective, its status and progress. Absent without a goal.                               |
| `forkOf`, `hidden`, `suggestedTitle`    | Where a fork came from, a chat no list should show, and the CLI's session title.                         |

Read absent optional arrays (`queue`, `background`, `skills`, `requests`) as empty.

`holdsConversation(info)` says whether the CLI holds a conversation for the chat: it named a session or a turn is in flight. While it does, the chat cannot switch to a CLI or account that cannot read its transcripts. A clear frees the chat again, although `usage.turns` still counts earlier turns.

## Items

`ChatItemSchema` is a union on `kind`. Every item has an `id`, a `createdAt` in milliseconds and a `turnId`, which is `null` outside a turn.

| `kind`       | What it is                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `user`       | A message, with the `mentions`, `skills`, `chats` and `attachments` the person picked.                             |
| `assistant`  | A reply. `streaming` is true while text still arrives.                                                             |
| `thinking`   | A stretch of the model thinking before it answers; `endedAt` is `null` while it runs.                              |
| `tool`       | A tool call: `input`, `output`, `state` (`running`, `done`, `error`), `progress`, file `changes`, a `workflow`.    |
| `subagent`   | An agent the chat delegated to: its prompt, `status` (`running`, `done`, `failed`), `result` and `usage`.          |
| `approval`   | A permission request and its `decision`: `pending`, `allow`, `allow-always`, `deny` or `cancelled`.                |
| `question`   | One or more questions, their `answers` once given, and a `state`.                                                  |
| `turn`       | A run of the agent: `state` (`running`, `done`, `aborted`, `error`), cost, checkpoints, and the `limit` it hit.     |
| `note`       | Information, a warning or an error from the host, by `level`.                                                      |
| `compaction` | The moment the context was folded, with the token count before it when known.                                      |

A running tool's `progress.output` holds only the last `TOOL_OUTPUT_TAIL` UTF-16 units. A tool `delta` carries only the new text, so grow the output with `appendToolOutput(output, text)`, which cuts it as the host does. Once the call settles, `output` replaces the progress.

An `assistant` or `tool` item with a `parentToolUseId` is a subagent's work. Draw it under that subagent, not as the chat's answer. A subagent item's `itemsTruncated` means the thread holds only the start, and `chat.subagent` reads the rest. A workflow's agent has no call of its own, so `chat.subagent` names it as `workflowAgentRef(agentId)`. `workflowAgentIdOf(ref)` reads the id back, or returns `null`.

A turn without `origin` was started by a person. A turn a restart could not resume is aborted with a warning note from `notResumedNote(reason)`, and `abortedByMachine(turn, items)` tells it from a person's stop. A turn the host ended because the opening agent was stopped gets a note whose id starts with `ENDED_NOTE_PREFIX`, which `abortedByEnd(turn, items)` recognizes.

Each kind has its own schema and type, from `ChatUserItemSchema` and `ChatUserItem` to `ChatCompactionItemSchema` and `ChatCompactionItem`.

## Attachments

A client sends an upload, `{ name, mime, data }`, with `data` as base64 without a `data:` prefix. The thread keeps `{ id, name, mime, size, path }`, where `path` is absolute on the host's machine.

| Limit                                  |                                       |
| -------------------------------------- | ------------------------------------- |
| `CHAT_ATTACHMENTS_MAX_COUNT`           | 8 per message                         |
| `CHAT_ATTACHMENT_MAX_BYTES`            | 10 MiB per attachment                 |
| `CHAT_ATTACHMENTS_MAX_BYTES`           | 10 MiB for all of a message together  |
| `name`, `mime`                         | 1 to 255 characters each              |
| `mentions`                             | At most 64                            |
| `skills`, `chats`                      | At most 16 each                       |

The limits count decoded bytes. The port enforces no frame size, so the transport must. `ChatSendPayloadSchema` requires nonblank text or at least one attachment. Its optional `delivery` is a `ChatDelivery` (`ChatDeliverySchema`, `"steer"` or `"queue"`), queueing by default. Steering returns the active turn id, queueing a new one.

`attachmentBytes(data)` is the decoded size of base64. `attachmentImageMime({ name, mime })` returns `image/png`, `image/jpeg`, `image/webp`, `image/gif` or `null`. It trusts the declared type and checks the extension only for an empty or generic binary type. It never reads the bytes.

## Approvals and questions

```ts
import { ChatAnswerPayloadSchema, ChatApprovePayloadSchema } from '@adecore/agent-contracts/chat';

const approval = ChatApprovePayloadSchema.parse({ chatId: 'chat-1', requestId: 'permission-1', decision: 'deny', message: 'Use the fixture instead.' });
const answer = ChatAnswerPayloadSchema.parse({ chatId: 'chat-1', requestId: 'question-1', answers: { layout: 'Compact' } });
```

A decision is `allow`, `allow-always` or `deny`. Offer `allow-always` only when the item has `canAllowAlways`, meaning the CLI proposed a rule. `allowAlways` holds its label and description. A denial reason reaches the agent only when the provider's capabilities include `denyReason`. An answer maps question ids to text, and a picked choice's answer is its label, so keep both whole. Only an `async` question may be dismissed, with `chat.dismiss` and its item id.

A request may settle elsewhere first, from another client or the CLI's own prompt. The host then refuses with `request-not-found`, and the client reads the state again.

`ChatRequestSummary` is the shortened request in `ChatInfo.requests`. `CHAT_REQUEST_LIMITS` says where its texts are cut. The host cuts, the schema has no `max`, so a bad cut never fails a whole `chat.list`. `truncated` marks a cut command or diff, and the thread keeps the whole call. `clipText(text, max)` cuts on a visible character boundary, never inside a surrogate pair.

## Bookmarks

A bookmark hangs on an item id, with an optional `name` and an `excerpt` of the message, within `CHAT_BOOKMARK_LIMITS`. Adding a bookmark to an item that has one keeps it and sets the name if given. Renaming to an empty name removes the name. Removing a missing bookmark is no error. Every change sends the whole list to attached clients as `chat.bookmarks`.

## Visuals

A visual is a page an agent published, shown in the thread at its `at` time. It is no item. The list comes with `chat.attach` and as `chat.visuals`, and `chat.removeVisual` removes one. See [Visuals](/agent-contracts/visuals).

## Checkpoints and forks

A turn's `checkpointDiff` lists the files changed since the turn started: `path`, `kind` (`add`, `update`, `delete`), lines `added` and `deleted`, and a unified `diff`. `omitted` says why a diff is empty (`binary` or `too-large`). `truncated` means more files changed than the list holds. `chat.turnDiff` returns `{ diff: null }` without a checkpoint, such as outside a repository. The contracts run no git.

A host may store values past `CHAT_PAYLOAD_INLINE_BYTES` apart from the thread. The item then carries the beginning and a `ChatPayloadRef`, `{ id, bytes }`. On a tool it is `outputRef`, and on a turn `checkpointDiffRef`, whose diff lists every file but empties the later diffs. `id` is opaque. `chat.toolOutput { chatId, itemId }` returns the whole `{ output }`, and `chat.turnDiff` the whole diff. A client that ignores the refs shows the beginning.

`chat.fork` starts a new chat with the history up to a turn. It takes an optional `title` (at most `CHAT_FORK_TITLE_MAX`), a worktree on a new branch, and another provider, model or account. `chat.forkInfo` returns what a fork dialog offers: whether the folder is a repository, the branches taken, and a free one to suggest. `chat.continueOn` moves a chat that stopped on a limit to another account of its CLI. Where a fork lands is the app's business (see [Protocol](/agent-contracts/protocol#requests)).

## Limits

A usage limit or an overloaded model is an `error` turn with `limit: { kind: 'usage' | 'overload', resetsAt? }`. `resetsAt` is absent when the CLI named no time. `ChatInfo.limit` repeats it for the header until the next turn opens.

## Goals

`/goal` gives a CLI an objective it pursues over turns until met. `ChatInfo.goal` is a `ChatGoal` (`ChatGoalSchema`) with:

- `objective`.
- `status`, a `ChatGoalStatus` (`ChatGoalStatusSchema`): `active`, `paused`, `blocked`, `usage-limited`, `budget-limited` or `complete`.
- What the CLI counts: `checks` and `lastCheck`, or `tokensUsed`, `tokenBudget` and `secondsUsed`.

`chat.goal` (`ChatGoalPayloadSchema`, `ChatGoalPayload`) applies a `ChatGoalAction` (`ChatGoalActionSchema`: `pause`, `resume`, `clear`) without a turn. The `goals` capability says which actions a CLI takes.

## Generated images

A tool named `ImageGeneration` stores a `GeneratedImageInput` (`GeneratedImageInputSchema`): an optional attachment, the revised prompt and whether the image is transparent. `generatedImageAttachment(item)` returns the attachment or `null`. A failed generation keeps its error in the tool output. Image bytes never go in a chat item. An attachment may carry `width` and `height` in pixels, and an assistant item the provider's `phase`, such as `commentary` or `final_answer`.

## Intelligent UI

An assistant item may carry `ui`, an array of UI block envelopes from `@adecore/intelligent-ui/protocol`. Each block carries its catalog version, a stable ID, its source range, its diagnostics and a Markdown fallback. An unknown component or catalog version leaves the rest of the history valid.

While a reply streams, a block preview rides on a `delta` with an empty `text`, an optional `ui` and `textLength`. It has no `seq`, stays out of the log and reaches only attached clients. Apply it only while the assistant item still streams and has that length. The final assistant item carries the tree that counts.

## Quoted replies and waiting notes

`ChatQuoteSourceSchema` and `ChatQuoteSource` name the assistant item a quote came from, as an optional `quoteSource` on a send, a queued message and a user item. The host keeps it only when that item is an assistant item of the chat. Forks keep it.

`WAITING_NOTE_PREFIX` starts the note a parent gets when a delegated child waits on a question or approval. Recognize such notes by this prefix.

## Choices in UI replies

`ChatUiChoicePayloadSchema` and `ChatUiChoicePayload` are the `chat.uiChoice` request: the chat, assistant item, block, revision and choice ids, plus optional local input `values`. Its result is a `ChatSendResult`. The client never sends a label or message context. The host reads both from the stored block and checks the choice against the block's revision.

`ChatUiChoiceOriginSchema` and `ChatUiChoiceOrigin` record on a user item or queued message where a choice came from. The assistant's optional `uiAnswers` map holds `ChatUiAnswerSchema` / `ChatUiAnswer` records with the answer's turn id and whether it queued. Picking the same choice again returns that turn. Another choice in that block is refused.

## Live UI query records

`ChatUiQueryPayloadSchema` and `ChatUiQueryPayload` are `ui.query`: chat, item, block, revision, the stored query's name, and optional local input values. A client never sends a source, SQL or fixed arguments.

`ChatUiQueryReadingSchema` and `ChatUiQueryReading` carry a fresh value with an opaque read id, or a failed or refused reading with its reason, an optional stable `code` and its time. The `state` values of readings and link resolutions are a closed set. `code` is any string. `ChatUiQueryStateSchema` and `ChatUiQueryState` keep on an assistant item the writer's chat and each block's first reading with its frozen fallback. A choice can name the read ids it showed, and the host fills in those values after checking access again.

`ChatUiLinkPayloadSchema` and `ChatUiLinkPayload` name a stored node for `ui.link`, with the block, local inputs and host-issued read ids. `ChatUiLinkReadingSchema` and `ChatUiLinkReading` say where the link goes, or why it stays plain text. Every open resolves the node and checks access again. `ChatUiPlaceReadingSchema` and `ChatUiPlaceReading` hold the point a host found for a `Place`, in a frozen block's optional `places` by node id, with its `address`. `state` is `found` or `missing`.
