# Conversation

A chat is a `ChatInfo` and a list of `ChatItem`s. The info says what the chat is and what it is doing; the items are its thread.

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
| `selection`, `model`                    | The model and options asked for, and the model the CLI reported. They can differ, through an alias.      |
| `runtimeMode`, `effectiveRuntimeMode`   | The permission policy asked for, and the one the running CLI confirmed, absent until it did.             |
| `status`                                | `running`, `needs-you`, `idle`, `error` or `exited`.                                                     |
| `running`, `activeTurnId`               | Whether the CLI process is alive, and the turn in flight. A live process can be idle between turns.      |
| `queue`, `queuePaused`                  | Messages sent during a turn, in the order they go out once it settles.                                   |
| `background`, `delegating`              | Shell commands and monitors the CLI keeps running, and whether a subagent of its own still works.        |
| `requests`                              | The approvals and questions that wait on a person, oldest first, at most `CHAT_REQUEST_LIMITS.perChat`.  |
| `usage`                                 | `ChatUsage`: context tokens, context window, cost, turns and an estimated `breakdown` of the context.    |
| `limit`, `resumeAt`, `resumeAtReset`    | The limit the last turn stopped on, when the host takes the chat up again, and the chat's own switch for that. |
| `forkOf`, `hidden`, `suggestedTitle`    | Where a fork came from, a chat no list should show, and the title the CLI gave the session.              |

Optional arrays such as `queue`, `background`, `skills` and `requests` are absent on records from before they existed; read absent as empty.

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

An `assistant` or `tool` item with a `parentToolUseId` is work a subagent did: draw it under that subagent, not as the chat's own answer. A subagent item's `itemsTruncated` says the thread holds only the start of its work; `chat.subagent` reads the rest from the CLI's own transcript. A workflow's agent has no call of its own, so `chat.subagent` names it as `workflowAgentRef(agentId)`, and `workflowAgentIdOf(ref)` reads the id back, or `null` for any other reference.

A turn without `origin` was started by a person, and one without `attempt` ran on one process. A turn that a restart could not take up again is aborted with a warning note that `notResumedNote(reason)` writes; `abortedByMachine(turn, items)` tells such a turn from one a person stopped.

The schema for each kind is exported on its own (`ChatUserItemSchema` up to `ChatCompactionItemSchema`), with a type for each (`ChatUserItem` up to `ChatCompactionItem`).

## Attachments

What a client sends is an upload, `{ name, mime, data }`, with `data` as base64 without a `data:` prefix. What the thread keeps is `{ id, name, mime, size, path }`: the bytes live in the host's attachment store, and `path` is absolute on the host's machine.

| Limit                                  |                                       |
| -------------------------------------- | ------------------------------------- |
| `CHAT_ATTACHMENTS_MAX_COUNT`           | 8 per message                         |
| `CHAT_ATTACHMENT_MAX_BYTES`            | 10 MiB per attachment                 |
| `CHAT_ATTACHMENTS_MAX_BYTES`           | 10 MiB for all of a message together  |
| `name`, `mime`                         | 1 to 255 characters each              |
| `mentions`                             | At most 64                            |
| `skills`, `chats`                      | At most 16 each                       |

The limits count decoded bytes. Base64 for 10 MiB leaves room for the prompt and the envelope inside a 16 MiB frame, but the port enforces no frame size: the transport has to. `ChatSendPayloadSchema` asks for text that is not blank or at least one attachment, and sets no length on the text. Its optional `delivery` uses `ChatDeliverySchema` (`"steer"` or `"queue"`). `ChatDelivery` is the corresponding type. Absent delivery queues during running work. Steering returns the active turn id; queueing reserves a new one.

`attachmentBytes(data)` is the decoded size of base64. `attachmentImageMime({ name, mime })` answers `image/png`, `image/jpeg`, `image/webp` or `image/gif`, or `null`. It trusts the declared type, and looks at the extension only when the type is empty or a generic binary one, so a declared PDF stays a PDF whatever its name. It never reads the bytes.

## Approvals and questions

```ts
import { ChatAnswerPayloadSchema, ChatApprovePayloadSchema } from '@adecore/agent-contracts/chat';

const approval = ChatApprovePayloadSchema.parse({ chatId: 'chat-1', requestId: 'permission-1', decision: 'deny', message: 'Use the fixture instead.' });
const answer = ChatAnswerPayloadSchema.parse({ chatId: 'chat-1', requestId: 'question-1', answers: { layout: 'Compact' } });
```

A decision is `allow`, `allow-always` or `deny`. Offer `allow-always` only when the item has `canAllowAlways`, which means the CLI proposed a rule; `allowAlways` holds its label and description. A reason on a denial reaches the agent only on a provider whose capabilities say `denyReason`. An answer maps question ids to text, and a chosen choice's answer is its label, so keep both whole. Only a question marked `async` may be dismissed, with `chat.dismiss` and its item id rather than its request id.

A request can settle elsewhere first: another client answered, or the person used the CLI's own prompt. The host then refuses with `request-not-found`, and the client reads the state again.

`ChatRequestSummary` is the cut-down request in `ChatInfo.requests`. `CHAT_REQUEST_LIMITS` says where its texts stop: 8 requests per chat, a subject of 200 UTF-16 code units, a description of 300, a command of 1000 or 12 lines, a diff of 1500 or 12 lines, a question of 500, a header of 100 and a choice description of 200. These are where a host cuts, not schema `max` rules, so a host that cuts wrong never makes a whole `chat.list` fail. `truncated` says a command or a diff was cut; the thread keeps the whole call. `clipText(text, max)` cuts on a character boundary as a person sees it, never between the halves of a surrogate pair.

## Bookmarks

A bookmark hangs on an item id, with an optional `name` and an `excerpt` of the message. `CHAT_BOOKMARK_LIMITS` allows a name of 120 characters, an excerpt of 160 and 200 bookmarks per chat. Adding a bookmark to an item that has one keeps it and names it when a name comes along; renaming to an empty name removes the name; removing one that is already gone is no error. Every change sends the whole list to every attached client as `chat.bookmarks`.

## Visuals

A visual is a page an agent published, shown in the thread at its `at`, between the items around it. It is no item: the chat's list comes with `chat.attach` and as `chat.visuals`, and `chat.removeVisual` takes one away. See [Visuals](/agent-contracts/visuals) for the record, the bridge between the page and the app, and the theme.

## Checkpoints and forks

A turn's `checkpointDiff` lists the files the working tree changed against the tree the turn started from: `path`, `kind` (`add`, `update`, `delete`), lines `added` and `deleted`, and a unified `diff`. `omitted` says why a diff is empty (`binary` or `too-large`), and `truncated` that more files changed than the list holds. `chat.turnDiff` answers `{ diff: null }` when there is no checkpoint, such as outside a repository. The contracts run no git.

`chat.fork` starts a new chat after a turn, with the history up to it. It can take a `title` (at most `CHAT_FORK_TITLE_MAX`, 120), a worktree on a new branch, another provider, model or account. `chat.forkInfo` answers what a fork dialog needs to offer: whether the folder is a repository, the branches taken, a free one to suggest. `chat.continueOn` moves a chat that stopped on a limit to another account of its CLI. Where a fork lands is the app's business; see [Protocol](/agent-contracts/protocol#requests).

## Limits

A usage limit or an overloaded model is not a turn state: it is an `error` turn with `limit: { kind: 'usage' | 'overload', resetsAt? }`. `resetsAt` is absent when the CLI named no time. `ChatInfo.limit` repeats it for the header until the next turn opens.

## Generated images

A tool named `ImageGeneration` stores a `GeneratedImageInput`: an optional attachment,
revised prompt and transparency flag. `GeneratedImageInputSchema` validates that metadata;
`generatedImageAttachment(item)` returns its attachment or `null`. A failed generation
keeps its error in the tool output and has no attachment. Image bytes never enter a chat
item. Attachment metadata may include pixel `width` and `height`. Assistant items may
include the provider's `phase`, such as `commentary` or `final_answer`. Both fields are
optional so existing records remain readable.


## Intelligent UI

An assistant item may carry `ui`, an array of open UI block envelopes from `@adecore/intelligent-ui/protocol`. Node types are strings, props and expression payloads are records, and each block carries its catalog version, stable ID, source range, diagnostics and Markdown fallback. Unknown component names and catalog versions do not invalidate the surrounding history.

A streaming preview uses an existing `delta` event with empty `text`, optional `ui` and `textLength`. It has no envelope `seq`, is not written to the chat log and is sent only to clients attached to that chat. A client applies it only to the matching length of a still-streaming assistant item. Older clients ignore these optional fields. The final assistant item carries the authoritative tree once and replays with the rest of the thread.
