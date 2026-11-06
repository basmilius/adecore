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
| `queue`, `queuePaused`                  | Messages sent during a turn, in send order, each a `ChatQueuedMessage`.                                  |
| `background`, `delegating`              | Shell commands and monitors the CLI keeps running, each a `ChatBackgroundTask` (`ChatBackgroundTaskSchema`), and whether its own subagent still works. |
| `requests`                              | The approvals and questions waiting on a person, oldest first, at most `CHAT_REQUEST_LIMITS.perChat`.    |
| `usage`                                 | `ChatUsage` (`ChatUsageSchema`): context tokens, context window, cost, turns and an estimated context `breakdown`. `cacheTtlMs` and `cacheExpiresAt` give the prompt cache lifetime when the CLI reports it. |
| `limit`, `resumeAt`, `resumeAtReset`    | The limit the last turn stopped on, when the host resumes, and the chat's switch for that.               |
| `goal`                                  | `ChatGoal`: the objective, its status and progress. Absent without a goal.                               |
| `forkOf`, `hidden`, `suggestedTitle`    | Where a fork came from, a chat no list should show, and the CLI's session title.                         |

Read absent optional arrays (`queue`, `background`, `skills`, `requests`) as empty. The `breakdown` is a `ChatContextBreakdown` (`ChatContextBreakdownSchema`): an estimate of how many context tokens are tool output, files read, conversation and system, scaled to add up to the context size.

`holdsConversation(info)` says whether the CLI holds a conversation for the chat: it named a session or a turn is in flight. While it does, the chat cannot switch to a CLI or account that cannot read its transcripts. A clear frees the chat again, although `usage.turns` still counts earlier turns.

`chatActivity(info)` is the one answer to whether a chat is busy, from its `ChatInfo`: `waiting` while a person is asked, `working` while a turn is open, `delegating` while a subagent or workflow still works, `background` while only commands the CLI started run, `holding` while a request is open, a goal is active or messages are queued, and `settled` otherwise. A host picks the levels its question counts: keeping a machine awake counts `working` and `delegating`, a restart waits for `working`, `waiting` and `delegating`, and a step that follows a chat's last turn waits for `settled`. `@adecore/agents/chat` re-exports it.

## Items

`ChatItemSchema` is a union on `kind`. Every item has an `id`, a `createdAt` in milliseconds and a `turnId`, which is `null` outside a turn.

| `kind`       | Type and schema | What it is |
| ------------ | --- | --- |
| `user`       | `ChatUserItem`, `ChatUserItemSchema` | A message, with the `mentions`, `skills`, `chats` and `attachments` the person picked. |
| `assistant`  | `ChatAssistantItem`, `ChatAssistantItemSchema` | A reply. `streaming` is true while text still arrives. |
| `thinking`   | `ChatThinkingItem`, `ChatThinkingItemSchema` | A stretch of the model thinking before it answers; `endedAt` is `null` while it runs. |
| `tool`       | `ChatToolItem`, `ChatToolItemSchema` | A tool call: `input`, `output`, `state`, `progress`, file `changes` and a `workflow`. |
| `subagent`   | `ChatSubagentItem`, `ChatSubagentItemSchema` | An agent the chat delegated to: its prompt, `status`, `result` and `usage`. |
| `approval`   | `ChatApprovalItem`, `ChatApprovalItemSchema` | A permission request and its `decision`. |
| `question`   | `ChatQuestionItem`, `ChatQuestionItemSchema` | One or more questions, their `answers` once given, and a `state`. |
| `turn`       | `ChatTurnItem`, `ChatTurnItemSchema` | A run of the agent: `state` (`running`, `done`, `aborted`, `error`), cost, checkpoints, and the `limit` it hit. |
| `note`       | `ChatNoteItem`, `ChatNoteItemSchema` | Information, a warning or an error from the host, by `level`. |
| `compaction` | `ChatCompactionItem`, `ChatCompactionItemSchema` | The moment the context was folded, with the token count before it when known. |

The parts of an item have their own types:

- A tool's `state` is a `ChatToolState` (`ChatToolStateSchema`): `running`, `done` or `error`. Its `progress` is a `ChatToolProgress` (`ChatToolProgressSchema`): when it started, what the CLI says it does, and the output so far. Each of its `changes` is a `ChatFileChange` (`ChatFileChangeSchema`), `{ path, kind, diff }`.
- A tool that runs a workflow carries a `ChatWorkflow` (`ChatWorkflowSchema`), with its `phases` (`ChatWorkflowPhase`, `ChatWorkflowPhaseSchema`) and the `agents` it started (`ChatWorkflowAgent`, `ChatWorkflowAgentSchema`).
- A subagent's `status` is a `ChatSubagentStatus` (`ChatSubagentStatusSchema`): `running`, `done` or `failed`. Its `usage` is a `ChatSubagentUsage` (`ChatSubagentUsageSchema`): total tokens, tool uses and duration.
- An approval's `decision` is a `ChatApprovalDecision` (`ChatApprovalDecisionSchema`): `pending`, `allow`, `allow-always`, `deny` or `cancelled`.
- A question item holds `ChatQuestion`s (`ChatQuestionSchema`): an `id`, a `header`, the `question`, its `choices` and whether more than one may be picked.
- A turn's `limit` is a `ChatTurnLimit` (`ChatTurnLimitSchema`), see [Limits](#limits).
- A note may carry the `message` another chat sent this one, a `ChatNoteMessage` (`ChatNoteMessageSchema`) with who sent it, their title and the text.

A running tool's `progress.output` holds only the last `TOOL_OUTPUT_TAIL` UTF-16 units. A tool `delta` carries only the new text, so grow the output with `appendToolOutput(output, text)`, which cuts it as the host does. Once the call settles, `output` replaces the progress.

An `assistant` or `tool` item with a `parentToolUseId` is a subagent's work. Draw it under that subagent, not as the chat's answer. A subagent item's `itemsTruncated` means the thread holds only the start, and `chat.subagent` reads the rest. A workflow's agent has no call of its own, so `chat.subagent` names it as `workflowAgentRef(agentId)`. `workflowAgentIdOf(ref)` reads the id back, or returns `null`.

A person started every turn without `origin`. The host aborts a turn a restart could not resume and adds a warning note from `notResumedNote(reason)`. `abortedByMachine(turn, items)` tells it from a person's stop. A turn the host ended because the opening agent was stopped gets a note whose id starts with `ENDED_NOTE_PREFIX`, which `abortedByEnd(turn, items)` recognizes.


## Attachments

A client sends an upload, a `ChatAttachmentUpload` `{ name, mime, data }`, with `data` as base64 without a `data:` prefix. `ChatAttachmentUploadsSchema` checks the uploads of one message together. The thread keeps a `ChatAttachment` (`ChatAttachmentSchema`), `{ id, name, mime, size, path }`, where `path` is absolute on the host's machine.

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

`ChatRequestSummary` (`ChatRequestSummarySchema`) is the shortened request in `ChatInfo.requests`. Its `kind` is a `ChatRequestKind` (`ChatRequestKindSchema`), `approval` or `question`. An approval carries a `ChatRequestApproval` (`ChatRequestApprovalSchema`): the tool, a one-line subject, and the file and file count of a change. `CHAT_REQUEST_LIMITS` says where the host cuts its texts. The schema has no `max`, so a bad cut never fails a whole `chat.list`. `truncated` marks a cut command or diff, and the thread keeps the whole call. `clipText(text, max)` cuts on a visible character boundary, never inside a surrogate pair.

## Bookmarks

A bookmark, a `ChatBookmark` (`ChatBookmarkSchema`), hangs on an item id, with an optional `name` and an `excerpt` of the message, within `CHAT_BOOKMARK_LIMITS`. Adding a bookmark to an item that has one keeps it and sets the name if given. Renaming to an empty name removes the name. Removing a missing bookmark is no error. Every change sends the whole list (`ChatBookmarksSchema`) to attached clients as `chat.bookmarks`.

## Visuals

A visual is a page an agent published, shown in the thread at its `at` time. It is no item. The list comes with `chat.attach` and as `chat.visuals`, and `chat.removeVisual` removes one. See [Visuals](/agent-contracts/visuals).

## Checkpoints and forks

A turn's `checkpointDiff`, a `ChatCheckpointDiff` (`ChatCheckpointDiffSchema`), lists the files changed since the turn started. Each is a `ChatCheckpointFile` (`ChatCheckpointFileSchema`) with `path`, `kind` (`add`, `update`, `delete`), lines `added` and `deleted`, and a unified `diff`. `omitted` says why a diff is empty (`binary` or `too-large`). `truncated` means more files changed than the list holds. `chat.turnDiff` returns `{ diff: null }` without a checkpoint, such as outside a repository. The contracts run no git.

A host may store values past `CHAT_PAYLOAD_INLINE_BYTES` apart from the thread. The item then carries the beginning and a `ChatPayloadRef` (`ChatPayloadRefSchema`), `{ id, bytes }`. On a tool it is `outputRef`, and on a turn `checkpointDiffRef`, whose diff lists every file but empties the later diffs. `id` is opaque. `chat.toolOutput { chatId, itemId }` returns the whole `{ output }`, and `chat.turnDiff` the whole diff. A client that ignores the refs shows the beginning.

`chat.fork` starts a new chat with the history up to a turn. It takes an optional `title` (at most `CHAT_FORK_TITLE_MAX`), a worktree on a new branch, and another provider, model or account. `chat.forkInfo` returns what a fork dialog offers: whether the folder is a repository, the branches taken, and a free one to suggest. `chat.continueOn` moves a chat that stopped on a limit to another account of its CLI. Where a fork lands is the app's business (see [Requests and events](/agent-contracts/requests#turns-and-forks)).

## Limits

A usage limit or an overloaded model is an `error` turn with `limit: { kind: 'usage' | 'overload', resetsAt? }`. `resetsAt` is absent when the CLI named no time. `ChatInfo.limit` repeats it for the header until the next turn opens.

## Goals

`/goal` gives a CLI an objective it pursues over turns until met. `ChatInfo.goal` is a `ChatGoal` (`ChatGoalSchema`) with:

- `objective`.
- `status`, a `ChatGoalStatus` (`ChatGoalStatusSchema`): `active`, `paused`, `blocked`, `usage-limited`, `budget-limited` or `complete`.
- What the CLI counts: `checks` and `lastCheck`, or `tokensUsed`, `tokenBudget` and `secondsUsed`.

`chat.goal` (`ChatGoalPayloadSchema`, `ChatGoalPayload`) applies a `ChatGoalAction` (`ChatGoalActionSchema`: `pause`, `resume`, `clear`) without a turn. The `goals` capability says which actions a CLI takes.

## Generated images

A tool named `ImageGeneration` stores a `GeneratedImageInput` (`GeneratedImageInputSchema`): an optional attachment, the revised prompt and whether the image is transparent. `generatedImageAttachment(item)` returns the attachment or `null`. A failed generation keeps its error in the tool output. Image bytes never go in a chat item. An attachment may carry `width` and `height` in pixels. An assistant item may carry the provider's `phase`, such as `commentary` or `final_answer`.

## Quoted replies and waiting notes

`ChatQuoteSourceSchema` and `ChatQuoteSource` name the assistant item a quote came from, as an optional `quoteSource` on a send, a queued message and a user item. The host keeps it only when that item is an assistant item of the chat. Forks keep it.

`WAITING_NOTE_PREFIX` starts the note a parent gets when a delegated child waits on a question or approval. Recognize such notes by this prefix.


## UI blocks

An assistant item may carry blocks of components, and a few requests act on them. See [UI blocks in replies](/agent-contracts/ui-replies).
