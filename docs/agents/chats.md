# Chats and turns

A chat is one CLI session with a thread. `ChatCore` keeps a `ChatSession` per chat, which owns the CLI process, the thread items, the queue and the open requests. The requests below are those of the [protocol](/agent-contracts/protocol#requests), and `host.chats` has a method for each.

## Creating and attaching

`chat.create` makes a chat or loads it from disk. Defaults for a new chat:

| Setting | Default |
| --- | --- |
| `provider` | Claude Code |
| `cwd` | The environment's `HOME`, else the user's home |
| Model | The catalog's default |
| Account | The CLI's default, or the one last picked |
| `runtimeMode` | `full-access` |

Set all of them in an app. A loaded chat keeps its provider, folder, account and model. Change those with `chat.configure`, which runs `admit` and `runtimeModeFor` again.

The CLI starts on the first message, not on create, and stays up between turns. A CLI that went down restarts with its session on the next message. `chat.attach` returns the thread and streams its events to that client.

## Sending

`chat.send` returns `{ queued, turnId }`. During a turn, a message waits in `info.queue` (`delivery: "queue"`, the default). With `delivery: "steer"` it joins the running turn, and the reply carries that turn's id. Slash commands, settings changes, backends without `steerTurn` and turns not yet started still queue. If a steer goes unconfirmed, the queue pauses until an explicit retry.

`ChatSession.sendInput` delivers what a person sends. `ChatSession.send` queues the host's own follow-ups for a new turn. `chat.unqueue` takes a message back for editing, or fails with `request-not-found` when it already went. `chat.sendNow` moves a queued message to the front and stops the running turn. Stopping a turn or hitting the usage limit can pause the queue (`queuePaused`), so check the info before you count on the rest going out.

Clients get deltas joined into fewer events. The host's thread always holds the whole text. `chat.status` goes to every client with the chat's info and a summary of open requests. A turn is `running`, `done`, `aborted` or `error`. `info.running` only says whether the process lives. An idle chat can still run a background shell or subagent.

## Approvals and questions

A pending approval or question is an item with a `requestId`. `chat.approve` answers with `allow`, `allow-always` or `deny`, plus an optional reason. `allow-always` grants the rule the CLI proposed, nothing wider. `chat.answer` answers a question by question id. `chat.dismiss` leaves an `async` question by item id. A request already settled elsewhere fails with `request-not-found`.

Stopping a turn settles its open requests. Optional Codex questions outlive their turn and keep the chat at `needs-you` until answered or dismissed. The answer starts a new turn if Codex has finished.

For a question the CLI never asked, such as a card a context command waits on, call `holdForPerson(chatId, key)`. The chat shows `needs-you` while its turn runs, and `releaseHold(chatId, key)` clears it once the last key is released. The card, its answer and its timeout stay with your app.

`relocate(chatId, cwd, during?)` moves a loaded chat to another folder on the same conversation:

- The CLI ends before `during` runs, so your app can move files freely.
- `admit` checks the new folder first. A refusal leaves the CLI running.
- Messages sent meanwhile queue and go out in the new folder. Outbox wakes are turned away.
- It resolves with the chat's info once the new record is on disk, then emits an info event.
- A throw from `during` or the write keeps the old folder.
- It fails with `chat-busy` while a turn, background work, an open request, a hold, an active goal, a start or another relocation holds the chat.
- Until it settles, `clear`, `restart`, `compact` and account changes fail with `chat-busy`, and `kill` waits. Check `isRelocating(chatId)` before your own forks and copies. An outbox handler that opens a turn answers `wait` while `WakeChat.relocating?.()` is true, as `deliverMessageHandler` does.

## Subagents

`chat.subagent` reads a delegated agent's conversation from the CLI's transcript, a page at a time. With `watch: true` it sends `chat.subagentChanged` as it grows. `chat.stopSubagent` stops a subagent a task opened, and its parent and siblings go on. It fails with `subagent-stale` during a turn of another process. Otherwise it only marks the row stopped. `chat.stopTask` stops one background shell or monitor, where the CLI supports it.

## Goals

`/goal <objective>` sets a goal and `/goal` alone shows its state. `/goal pause`, `/goal resume` and `/goal clear` act on it. The goal is `info.goal`. Claude Code pursues it within one turn. Codex opens further turns itself until the goal is met. Stopping a Codex turn pauses its goal first.

While a goal is active, messages queue, `delivery: "steer"` included. `chat.goal` pauses, resumes or clears without a turn on a CLI with goal calls. Otherwise it sends `/goal` as a turn and fails with `chat-busy` during a turn. A met goal clears from `info.goal` on the next message.

## Searching and resuming

`searchThreadItems(items, query, { limit })` from `@adecore/agents/chat` returns `ThreadHit` records with a snippet for each user or assistant message that matches (`ThreadSearchOptions` holds the limit). `findClaudeSession(projectsDir, sessionId, cwd?)` returns the path of a Claude session's transcript, searching `cwd`'s project folder first. It caches the location, so call it as often as you need.

`listClaudeSessions` and `listCodexSessions` from `@adecore/agents/chat` list CLI sessions started outside your app, newest first, as `ExternalSession` records. They read through a `SessionFs`, and `nodeSessionFs()` reads the real disk. Codex forks and subagents (`isForkOrSubagent`) are left out.

## Visuals

A [visual](/agent-contracts/visuals) is a page an agent publishes in a chat, through a command of your app. That command calls `host.chats.publishVisual(chatId, { title, html, maxHeight?, layout?, heights?, turnId? })` and gets the `ChatVisual` back. The chat need not be loaded. A visual published during a turn belongs to it unless the input names another. `listVisuals(chatId)` returns the visuals in publish order, and `chat.removeVisual` removes one.

`VisualStore` keeps the list in `chats/<id>.visuals.json` and each page as an attachment, so `host.chats.attachment(chatId, visualId)` returns it as `text/html`. Publishing injects the bootstrap of `injectVisualBootstrap` and checks `VISUAL_LIMITS`. A page that breaks one fails with `visual-invalid` or `visual-too-large` and a message for the agent. Changes reach attached clients as `chat.visuals`, and `chat.attach` returns the list too.

Clear and `chat.kill` remove a chat's visuals. A core of your own that forks chats copies them with `visuals.copyChat(fromChatId, toChatId, keep?)`. `removeChat(chatId)` cleans up after a failed fork. Never serve an attached `text/html` file on your app's own origin (see [Serving a page](/agent-contracts/visuals#serving-a-page)).

## Stopping and removing

| Request                                 |                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `chat.cancel`                           | Stops the turn and keeps the conversation. With `subagents`, also ends the agents the chat opened. |
| `chat.clear`                            | Starts the chat over. Refused with `chat-busy` during a turn, unless `force`.                    |
| `chat.compact`                          | Folds the context, natively or by prompt, as the CLI's `compaction` capability says.             |
| `chat.restart`                          | Ends the CLI and keeps the conversation. The next message resumes it in a fresh process that reloads skills, plugins and servers. Fails with `chat-busy` while a turn, request or background work holds the process. |
| `chat.kill`                             | Removes the chat (record, log, attachments, bookmarks, visuals) and ends its CLI.               |
| Detaching or disconnecting              | Stops streaming to that client. The chat goes on.                                                |
| `host.close()`, `ChatCore.shutdown()`   | Writes every thread, ends every CLI and settles once they exited.                                |

Ending a CLI closes its input, then sends SIGTERM and SIGKILL to its process group. `chat.kill` does not wait. `shutdown` does. Process groups are POSIX, so check ending on every platform you ship.

## Restarts

A turn running when the host went down loads as aborted, with a note from `notResumedNote`. If `onInterruptedRun` returns `true`, the host owes a resume instead and calls `recoverInterrupted()` and `resumeRun(chatId, turnId, attempt)` when ready. `endedAt`, `unownedReason` and `resumeWords` mark deliberate stops and word the resume.

A turn that hit the usage limit or an overloaded model ends as an `error` turn with a `limit`. Resuming it when the limit lifts needs `limitResume` on the core, which `AgentHost` does not install. `resumeAtReset` on a chat turns it off for that chat. Moving the chat to another account is always the person's choice.

## Visual working files

`VisualStore.writeSource(chatId, name, html)` saves a source in `<home>/chats/<encodedChatId>.visuals/`, apart from the published page. The name ends in `.html` and has no folder. Sources share the visual byte limit. `writePreview(chatId, png)` writes a preview there.

`workspacePath(chatId)` returns the folder, and `prepareWorkspace(chatId)` creates it, owner-readable only. `removeChat` removes sources and previews with the visuals. Forks copy only published pages.

## Live UI sources

`ChatCoreOptions.uiFenceLanguage` sets the fence info string sessions compile (default `UI_FENCE_LANGUAGE`). `ChatCoreOptions.intelligentUi` takes a `ChatUiHost` from `@adecore/agents/chat`. The host records what the writing chat may read and registers a fixed list of `ChatUiSource` entries. Each has argument and result schemas, `authorize`, and an abortable read. `authorize` checks both the recorded and the current rights, also before serving a cached value. Throw a `ChatUiRefusal(code, reason)` to give a refusal or failed read a stable code.

`ChatUiQueries` compiles against those schemas and freezes the first results and text fallback in the reply. It answers `ui.query` only for a client attached to that chat, after checking the stored block and bound inputs. Reads are rate limited and slow sources time out. Nothing refreshes in the background.

The recorded access lives in the chat record under `uiAccess` and never reaches a client. A fork records its own rights. After a restart, a read without complete saved access fails. `ChatCore.choose` passes only host-issued query values, and a client read id grants nothing.

A reply that drew UI keeps the block source in its `text`. `readableAssistantText(item)` from `@adecore/agents/chat` returns the text with each block replaced by its fallback. Use it wherever your app hands a reply to another agent, a notification or a search index.

`ChatUiHost.link` checks File, Diff, Commit and Node targets against what the writer could reach then and now. `ui.link` answers only for a stored, visible node in an attached chat. A missing or refused link stays plain text. `ChatUiHost.place` resolves a `Place` once when the reply settles (see [Live queries](/intelligent-ui/host/queries#places)). [Live queries](/intelligent-ui/host/queries) and [Links](/intelligent-ui/host/links) cover both sides.
