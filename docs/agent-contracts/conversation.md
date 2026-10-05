# Conversation content

A conversation is a `ChatInfo` plus ordered `ChatItem` records. An item has an id, an epoch-millisecond `createdAt`, and a nullable `turnId`. A null turn id means the item is outside a turn. Keep item ids when applying updates or storing bookmarks.

## Thread items

`ChatItemSchema` discriminates on `kind`:

| Kind         | Meaning and lifetime                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `user`       | Prompt text with optional mentions, skills, chat references, and stored attachments                                    |
| `assistant`  | Answer text; `streaming` marks incomplete content                                                                      |
| `thinking`   | Thinking text; nullable `endedAt` while it runs                                                                        |
| `tool`       | Input, output, progress, file changes, and optional workflow state; state is `running`, `done`, or `error`             |
| `subagent`   | Delegated work, result, usage, native reference, and optional child identity; status is `running`, `done`, or `failed` |
| `approval`   | A tool permission request with its settled or pending decision                                                         |
| `question`   | One or more questions with nullable answers and state                                                                  |
| `turn`       | A run with state `running`, `done`, `aborted`, or `error`; may carry checkpoints, resume metadata, or a limit          |
| `note`       | Host-visible information, warning, or error text                                                                       |
| `compaction` | A context compaction marker with nullable prior token count                                                            |

`parentToolUseId` associates assistant/tool output with delegated work. Render that content under its subagent instead of treating it as a main answer. A subagent's `itemsTruncated` means its inline preview is incomplete; use `chat.subagent` to read the native conversation. `workflowAgentRef(agentId)` and `workflowAgentIdOf(ref)` convert workflow references without guessing the prefix.

`ChatInfo.selection` is the requested model/options. `model` is the provider-reported model and may differ. Likewise, `runtimeMode` is requested policy and optional `effectiveRuntimeMode` is what the current process reported. `running` means a process is alive; `activeTurnId` distinguishes an active turn from an idle process.

Optional arrays such as `queue`, `background`, `skills`, and `requests` support older records. Read an absent array as empty where that field documents an empty state. A missing turn `origin` means user initiated; missing `attempt` means one process attempt. Subagent origin preserves a historical host value for existing records; do not rename that wire value during an import migration. See [compatibility](./validation-and-compatibility#protocol-and-storage-compatibility).

## Attachments and prompt references

Uploads carry `{ name, mime, data }`; persisted attachments carry `{ id, name, mime, size, path }`. Bytes belong in the host attachment store. `path` is absolute on the backend machine, so a remote client needs a host-authorized file adapter to display it.

| Limit                        | Value                            |
| ---------------------------- | -------------------------------- |
| `CHAT_ATTACHMENTS_MAX_COUNT` | 8 per message                    |
| `CHAT_ATTACHMENT_MAX_BYTES`  | 10 MiB per attachment            |
| `CHAT_ATTACHMENTS_MAX_BYTES` | 10 MiB combined per message      |
| Upload name and MIME         | 1 to 255 UTF-16 code units each  |
| Mentions                     | At most 64 nonempty strings      |
| Skills and referenced chats  | At most 16 nonempty strings each |

`attachmentBytes(data)` computes decoded byte length. `attachmentImageMime({ name, mime })` recognizes PNG, JPEG, WebP, and GIF. It falls back to the extension only for an empty or generic binary MIME type, so a declared PDF does not become an image because of its filename. It does not validate image bytes.

`ChatSendPayloadSchema` requires nonblank text or at least one attachment. It places no explicit text length cap. The transport must enforce its own frame size; the aggregate attachment limit leaves room in the original 16 MiB transport design, but `FramePort` itself does not enforce that size.

## Tool approvals and questions

```ts
import { ChatApprovePayloadSchema, ChatAnswerPayloadSchema } from '@adecore/agent-contracts/chat';

const approval = ChatApprovePayloadSchema.parse({
    chatId: 'chat-1',
    requestId: 'permission-1',
    decision: 'deny',
    message: 'Use the project fixture instead.'
});
const answer = ChatAnswerPayloadSchema.parse({
    chatId: 'chat-1',
    requestId: 'question-1',
    answers: { layout: 'Compact' }
});
```

Chat decisions are `allow`, `allow-always`, and `deny`. Offer `allow-always` only when the provider supplied a rule and `canAllowAlways` permits it. A denial reason is optional and only reaches providers that support it. Answers map question ids to strings; choice labels are answer values. Preserve ids and labels instead of clipping them for display.

Only an asynchronous question can be dismissed. `chat.dismiss` names its thread `itemId`, while answers and approvals name `requestId`. A request may settle through another client or the provider's own UI before an answer arrives; handle `request-not-found` by refreshing the state.

`CHAT_REQUEST_LIMITS` sets display summaries: eight requests per chat, subject 200, description 300, command 1,000/12 lines, diff 1,500/12 lines, question 500, header 100, and choice description 200. These are backend summary limits, not schema `max` constraints. A full thread retains the underlying call. `clipText(text, max)` clips on grapheme boundaries within a UTF-16 budget.

Terminal approval contracts differ. `ApprovalRequest` has offered `ApprovalChoice` ids, an expiry time, and a session id. `ApprovalAnswerResult.accepted` is false after settlement or expiry. `ApprovalPreferencePayload.enabled` applies to one client connection; a client that never sends it retains the historical opt-in behavior. Those contracts need host-supplied terminal integration.

## Bookmarks, checkpoints, and limits

Bookmarks refer to item ids and include an excerpt. `CHAT_BOOKMARK_LIMITS` allows names of 120 code units, excerpts of 160, and 200 bookmarks per chat. The backend limits bookmarks to main-thread user and assistant messages. Removing an already removed bookmark is idempotent; renaming a missing bookmark is an error.

Checkpoint files contain a path, change kind, line counts, and diff text. `omitted` explains an empty diff for a binary or oversized file; `truncated` says the list is incomplete. A null `chat.turnDiff` result means no usable checkpoint. Contracts do not run Git or authorize a worktree operation.

A usage or overload limit is metadata on an error turn, not another turn state. Its reset time is optional. `resumeAtReset` is a per-chat override; an absent value follows host policy. `notResumedNote(reason)` and `abortedByMachine(turn, items)` identify a restart-aborted turn through its warning note.
