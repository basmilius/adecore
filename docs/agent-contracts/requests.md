# Requests and events

`AGENT_REQUEST_SCHEMAS` maps every request name to `{ payload, result }`, and `AGENT_EVENT_SCHEMAS` maps every event name to its payload schema. `AgentRequestType` and `AgentEventType` are the unions of their names. This page lists both tables with the schema of each side and the type inferred from it. [Protocol](/agent-contracts/protocol) covers the frames they travel in.

Not every host implements every request. A host that only runs chats refuses the fork requests with `chat-unsupported` (see [Host](/agents/host#what-a-plain-host-refuses)). A request without a payload or a result uses `EmptySchema`, `{}`.

## Open and read

| Request | Payload | Result |
| --- | --- | --- |
| `chat.create` | `ChatCreatePayloadSchema` (`ChatCreatePayload`) | `ChatInfoSchema` (`ChatInfo`) |
| `chat.list` | `EmptySchema` | `ChatListResultSchema` (`ChatListResult`) |
| `chat.attach` | `ChatAttachPayloadSchema` | `ChatAttachResultSchema` (`ChatAttachResult`) |
| `chat.detach` | `ChatTargetPayloadSchema` (`ChatTargetPayload`) | `EmptySchema` |
| `chat.history` | `ChatHistoryPayloadSchema` | `ChatHistoryResultSchema` (`ChatHistoryResult`) |
| `chat.toolOutput` | `ChatToolOutputPayloadSchema` (`ChatToolOutputPayload`) | `ChatToolOutputResultSchema` (`ChatToolOutputResult`) |

`chat.create` takes a `chatId` the client picks, and optionally a provider, account, folder, model selection and runtime mode. `ChatIdSchema` (`ChatId`) is any nonempty string. `ChatTargetPayload` is `{ chatId }`, the payload of every request that only names a chat.

`chat.attach` takes an optional `historyLimit` and the `since` of a reconnect. `chat.history` takes a `cursor` and an optional `limit`, and returns `items` with a `history` page (`ChatHistoryPageSchema`, `{ start, cursor }`). See [Attaching and replay](/agent-contracts/protocol#attaching-and-replay).

## Send and control

| Request | Payload | Result |
| --- | --- | --- |
| `chat.send` | `ChatSendPayloadSchema` (`ChatSendPayload`) | `ChatSendResultSchema` (`ChatSendResult`) |
| `chat.unqueue` | `ChatQueuePayloadSchema` (`ChatQueuePayload`) | `ChatUnqueueResultSchema` (`ChatUnqueueResult`) |
| `chat.sendNow` | `ChatQueuePayloadSchema` | `EmptySchema` |
| `chat.cancel` | `ChatCancelPayloadSchema` (`ChatCancelPayload`) | `EmptySchema` |
| `chat.compact` | `ChatTargetPayloadSchema` | `EmptySchema` |
| `chat.clear` | `ChatClearPayloadSchema` (`ChatClearPayload`) | `EmptySchema` |
| `chat.restart` | `ChatTargetPayloadSchema` | `EmptySchema` |
| `chat.kill` | `ChatTargetPayloadSchema` | `EmptySchema` |

`chat.send` answers `{ queued, turnId? }` once the host took the message. A queued message is a `ChatQueuedMessage` (`ChatQueuedMessageSchema`) in `ChatInfo.queue`. `chat.unqueue` and `chat.sendNow` name it by `messageId`, and `chat.unqueue` returns it so the client can put it back in the draft. `chat.cancel` with `subagents: true` also stops every agent the chat opened. `chat.clear` refuses a chat in the middle of a turn unless it carries `force: true`.

## Answer

| Request | Payload | Result |
| --- | --- | --- |
| `chat.approve` | `ChatApprovePayloadSchema` (`ChatApprovePayload`) | `EmptySchema` |
| `chat.answer` | `ChatAnswerPayloadSchema` (`ChatAnswerPayload`) | `EmptySchema` |
| `chat.dismiss` | `ChatDismissPayloadSchema` (`ChatDismissPayload`) | `EmptySchema` |

See [Approvals and questions](/agent-contracts/conversation#approvals-and-questions).

## Configure

| Request | Payload | Result |
| --- | --- | --- |
| `chat.configure` | `ChatConfigurePayloadSchema` (`ChatConfigurePayload`) | `ChatInfoSchema` |
| `chat.setPreferences` | `ChatPreferencesPayloadSchema` (`ChatPreferencesPayload`) | `EmptySchema` |
| `skills.list` | `SkillsListPayloadSchema` (`SkillsListPayload`) | `SkillsListResultSchema` (`SkillsListResult`) |
| `provider.list` | `EmptySchema` | `ProviderListResultSchema` (`ProviderListResult`) |

`chat.configure` changes a chat's account, model selection, runtime mode or `resumeAtReset`. The account must be able to continue the conversation. `chat.setPreferences` stores what new chats start with: a runtime mode, a model selection and an account per provider. `skills.list` returns the skills a chat can use, each a `ChatSkill` (`ChatSkillSchema`) with a `ChatSkillSource` (`ChatSkillSourceSchema`).

## Turns and forks

| Request | Payload | Result |
| --- | --- | --- |
| `chat.turnDiff` | `ChatTurnDiffPayloadSchema` (`ChatTurnDiffPayload`) | `ChatTurnDiffResultSchema` (`ChatTurnDiffResult`) |
| `chat.fork` | `ChatForkPayloadSchema` (`ChatForkPayload`) | `ChatForkResultSchema` (`ChatForkResult`) |
| `chat.forkInfo` | `ChatForkInfoPayloadSchema` (`ChatForkInfoPayload`) | `ChatForkInfoResultSchema` (`ChatForkInfoResult`) |
| `chat.summarize` | `ChatSummarizePayloadSchema` (`ChatSummarizePayload`) | `ChatSummarizeResultSchema` (`ChatSummarizeResult`) |
| `chat.continueOn` | `ChatContinueOnPayloadSchema` (`ChatContinueOnPayload`) | `ChatContinueOnResultSchema` (`ChatContinueOnResult`) |

`chat.summarize` returns the turn in which the chat writes its summary. `chat.continueOn` returns the chat that goes on, and the fork when it went on in one. See [Checkpoints and forks](/agent-contracts/conversation#checkpoints-and-forks).

## Delegated work

| Request | Payload | Result |
| --- | --- | --- |
| `chat.subagent` | `ChatSubagentPayloadSchema` (`ChatSubagentPayload`) | `ChatSubagentResultSchema` (`ChatSubagentResult`) |
| `chat.stopSubagent` | `ChatStopSubagentPayloadSchema` (`ChatStopSubagentPayload`) | `EmptySchema` |
| `chat.stopTask` | `ChatStopTaskPayloadSchema` (`ChatStopTaskPayload`) | `EmptySchema` |
| `chat.goal` | `ChatGoalPayloadSchema` (`ChatGoalPayload`) | `EmptySchema` |

`chat.subagent` reads one subagent's conversation by the `toolUseId` of the call that started it, a page at a time. With `watch: true` the host sends `chat.subagentChanged` while it grows. The result holds `items`, a page (`ChatSubagentPageSchema`), the `pending` requests, whether it is still `live`, and its `source`, a `ChatSubagentSource` (`ChatSubagentSourceSchema`) that says which CLI's record it was read from. `chat.stopTask` stops one background task by `taskId`.

## Bookmarks and visuals

| Request | Payload | Result |
| --- | --- | --- |
| `chat.addBookmark` | `ChatAddBookmarkPayloadSchema` (`ChatAddBookmarkPayload`) | `ChatBookmarksResultSchema` (`ChatBookmarksResult`) |
| `chat.renameBookmark` | `ChatRenameBookmarkPayloadSchema` (`ChatRenameBookmarkPayload`) | `ChatBookmarksResultSchema` |
| `chat.removeBookmark` | `ChatRemoveBookmarkPayloadSchema` (`ChatRemoveBookmarkPayload`) | `ChatBookmarksResultSchema` |
| `chat.removeVisual` | `ChatRemoveVisualPayloadSchema` (`ChatRemoveVisualPayload`) | `ChatVisualsResultSchema` (`ChatVisualsResult`) |

See [Bookmarks](/agent-contracts/conversation#bookmarks) and [Visuals](/agent-contracts/visuals).

## UI blocks

| Request | Payload | Result |
| --- | --- | --- |
| `chat.uiChoice` | `ChatUiChoicePayloadSchema` (`ChatUiChoicePayload`) | `ChatSendResultSchema` |
| `ui.query` | `ChatUiQueryPayloadSchema` (`ChatUiQueryPayload`) | `ChatUiQueryReadingSchema` (`ChatUiQueryReading`) |
| `ui.link` | `ChatUiLinkPayloadSchema` (`ChatUiLinkPayload`) | `ChatUiLinkReadingSchema` (`ChatUiLinkReading`) |

See [UI blocks in replies](/agent-contracts/ui-replies).

## Accounts

| Request | Payload | Result |
| --- | --- | --- |
| `accounts.list` | `EmptySchema` | `ProviderAccountsSchema` (`ProviderAccounts`) |
| `accounts.save` | `ProviderAccountsSavePayloadSchema` (`ProviderAccountsSavePayload`) | `ProviderAccountsSchema` |
| `accounts.reorder` | `ProviderAccountsReorderPayloadSchema` (`ProviderAccountsReorderPayload`) | `ProviderAccountsSchema` |
| `accounts.create` | `ProviderAccountCreatePayloadSchema` (`ProviderAccountCreatePayload`) | `ProviderAccountCreateResultSchema` (`ProviderAccountCreateResult`) |
| `accounts.refresh` | `EmptySchema` | `ProviderAccountsSchema` |
| `accounts.watchLogin` | `ProviderAccountWatchLoginPayloadSchema` (`ProviderAccountWatchLoginPayload`) | `EmptySchema` |

`accounts.watchLogin` answers at once, and later results arrive as `accounts.changed`. See [Accounts](/agent-contracts/accounts).

## Usage

| Request | Payload | Result |
| --- | --- | --- |
| `usage.summary` | `UsageSummaryPayloadSchema` (`UsageSummaryPayload`) | `UsageSummaryResultSchema` (`UsageSummaryResult`) |
| `usage.subscribe` | `EmptySchema` | `EmptySchema` |
| `usage.unsubscribe` | `EmptySchema` | `EmptySchema` |
| `usage.limits` | `EmptySchema` | `UsageLimitsSnapshotSchema` (`UsageLimitsSnapshot`) |
| `usage.refreshLimits` | `EmptySchema` | `UsageLimitsSnapshotSchema` |

See [Usage](/agent-contracts/usage).

## Events

| Event | Payload | What a client does with it |
| --- | --- | --- |
| `chat.event` | `ChatEventEnvelopeSchema` (`ChatEventEnvelope`) | `{ chatId, event, seq? }`: apply the `ChatEvent` to a thread the client attached. |
| `chat.status` | `ChatStatusEventSchema` (`ChatStatusEvent`) | `{ chatId, info }`: the chat's whole `ChatInfo`, to every client, attached or not. |
| `chat.subagentChanged` | `ChatSubagentChangedEventSchema` (`ChatSubagentChangedEvent`) | `{ chatId, toolUseId }`: ask for the watched subagent page again. It carries no conversation. |
| `chat.bookmarks` | `ChatBookmarksEventSchema` (`ChatBookmarksEvent`) | `{ chatId, bookmarks }`: the attached chat's whole bookmark list. |
| `chat.visuals` | `ChatVisualsEventSchema` (`ChatVisualsEvent`) | `{ chatId, visuals }`: the attached chat's whole list of [visuals](/agent-contracts/visuals). |
| `accounts.changed` | `ProviderAccountsSchema` | The whole account snapshot. |
| `usage.changed` | `UsageChangedEventSchema` (`UsageChangedEvent`) | `{ scannedAt }`: ask for the period on screen again. |
| `usage.limitsChanged` | `UsageLimitsSnapshotSchema` | The whole plan limit snapshot. |

`chat.status` goes to every client, so a chat waiting on a person shows it everywhere. `info.requests` carries a card-sized summary of the waiting approvals and questions. `ChatEventSchema` (`ChatEvent`) is the event inside a `chat.event`; [Attaching and replay](/agent-contracts/protocol#attaching-and-replay) lists its kinds.
