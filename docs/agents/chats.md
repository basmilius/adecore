# Chats and turns

A chat is one CLI session with a thread. `ChatCore` keeps a `ChatSession` per chat; the session owns the CLI process, turns what it writes into thread items, and holds the queue and the requests that wait. The requests below are those of the [protocol](/agent-contracts/protocol#requests); `host.chats` has a method for each.

## Creating and attaching

`chat.create` makes a chat, or loads it from disk. A new chat runs on Claude Code unless it names a `provider`, works in `cwd` (else the environment's `HOME`, else the user's home), starts on the catalog's default model, under the CLI's default account or the one last picked, and in `full-access` unless it names a `runtimeMode`. Name all of them in an app. A chat loaded from disk keeps the provider, folder, account and model it has; change those with `chat.configure`, which `admit` and `runtimeModeFor` look at again.

Creating a chat starts nothing. The CLI starts on the first message and stays up between turns; a CLI that went down is started again with its session on the next message. `chat.attach` answers the thread and streams its events to that client from then on.

## Sending

`chat.send` answers `{ queued, turnId }`. During an active turn, a message waits in `info.queue` until the turn settles. Pass `delivery: "steer"` to forward it to the native backend and return that turn's id after acceptance. `delivery: "queue"` explicitly selects the default. Slash commands, settings changes, backends without `steerTurn` and a turn that has not started yet use the end-of-turn queue. Pending native submissions stay in the queue until acknowledged; a lost acknowledgement pauses automatic replay. `ChatSession.sendInput` handles user delivery, while `ChatSession.send` keeps internal follow-ups queued for a new turn. `chat.unqueue` takes a message back out, answering it so it can be edited, or `request-not-found` when it already went. `chat.sendNow` moves a queued message to the front and stops the running turn, so it goes out next. Stopping a turn can pause the queue (`queuePaused`), and a turn that stopped on the usage limit holds it too: read the info before counting on the rest going out.

Deltas are joined before they go out, so a client gets fewer, larger events than the CLI writes; the thread on the host always holds the whole text. `chat.status` goes to every client with the chat's info, including a short form of the requests that wait. A turn is `running`, `done`, `aborted` or `error`; `info.running` is only whether the process lives, and an idle chat can still have a shell or a subagent of its CLI running in the background.

## Approvals and questions

A pending approval or question is an item with a `requestId`. `chat.approve` answers an approval with `allow`, `allow-always` or `deny`, and a reason for a CLI that takes one. `allow-always` grants the rule the CLI proposed, nothing wider. `chat.answer` answers a question by question id, and `chat.dismiss` leaves an `async` question by its item id. A request settled elsewhere first, by another client or in the CLI's own prompt, is refused with `request-not-found`.

Stopping a turn settles the requests it left open, so no approval stays pending under a finished turn.

## Subagents

`chat.subagent` reads the conversation of an agent the chat delegated to, from the CLI's own transcript, a page at a time, and with `watch: true` sends `chat.subagentChanged` while it grows. `chat.stopSubagent` stops a subagent a task of your app opened; a subagent of the CLI's own can only be marked stopped. `chat.stopTask` stops one background shell or monitor, on a CLI that can.

## Visuals

A [visual](/agent-contracts/visuals) is a page an agent publishes in a chat. Agents publish through a command of your app, which calls `host.chats.publishVisual(chatId, { title, html, maxHeight?, layout?, heights?, turnId? })` and gets the `ChatVisual` back. The chat may be one nobody loaded; a visual published while a turn runs belongs to that turn unless the input names another. `listVisuals(chatId)` answers a chat's visuals in the order they were published, and `chat.removeVisual` takes one away.

`VisualStore` keeps them: the list in `chats/<id>.visuals.json`, each page as `<id>.html` in the chat's attachment folder, so `host.chats.attachment(chatId, visualId)` finds a page the way it finds an attached file, with the mime type `text/html`. Publishing puts the bootstrap of `injectVisualBootstrap` in the page and checks `VISUAL_LIMITS`; a page that breaks one is refused with `visual-invalid` or `visual-too-large`, with a message that tells the agent what to change. Every change goes to the clients attached to the chat as `chat.visuals`, and `chat.attach` answers the list too.

A clear and `chat.kill` take a chat's visuals along. A core of your own that forks chats gives the fork its visuals with `visuals.copyChat(fromChatId, toChatId, keep?)`, which writes each page again under the fork, so removing either chat leaves the other's pages. `removeChat(chatId)` takes back what a fork that failed wrote. Never serve an attached `text/html` file on your app's own origin; see [Serving a page](/agent-contracts/visuals#serving-a-page).

## Stopping and removing

| Request                                 |                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `chat.cancel`                           | Stops the turn and keeps the conversation. With `subagents`, also ends the agents the chat opened. |
| `chat.clear`                            | Starts the chat over. Refused with `chat-busy` during a turn, unless `force`.                    |
| `chat.compact`                          | Folds the context, natively or by prompt, as the CLI's `compaction` capability says.             |
| `chat.kill`                             | Removes the chat: its record, log, attachments, bookmarks and visuals, and ends its CLI.         |
| Detaching or disconnecting              | Stops streaming to that client. The chat goes on.                                                |
| `host.close()`, `ChatCore.shutdown()`   | Writes every thread and ends every CLI, and settles once they exited.                            |

A CLI is ended by closing its input, then, after three seconds, SIGTERM to its process group and SIGKILL two seconds later. `chat.kill` does not wait for that; `shutdown` does. Process groups are a POSIX notion: check how ending works on the platforms you ship.

## Restarts

A host that goes down during a turn freezes it before it writes the thread, so the turn does not read as failed. When the chat loads again, the turn is ended as aborted with a note written by `notResumedNote`, unless `onInterruptedRun` answers `true`: then the host owes a resume and calls `recoverInterrupted()` and `resumeRun(chatId, turnId, attempt)` when it is ready. A turn is taken up on at most two processes. `endedAt`, `unownedReason` and `resumeWords` let a host say when a chat was stopped on purpose and how the resume is worded.

A turn that hit the plan's usage limit or an overloaded model ends as an `error` turn with a `limit`. Taking it up again when the limit lifts needs `limitResume` on the core; `AgentHost` installs none. `resumeAtReset` on a chat turns it off for that chat. Moving the chat to another account is a person's choice, never automatic.

## Visual working files

`VisualStore.writeSource(chatId, name, html)` saves unmodified HTML in `<home>/chats/<encodedChatId>.visuals/`, separate from the published attachment. The filename must end in `.html` and cannot contain a directory; source pages have the same byte limit as published visuals. Writing the same name replaces the source without changing the published page. `writePreview(chatId, png)` writes a preview with a unique filename in that folder.

`workspacePath(chatId)` returns the folder; `prepareWorkspace(chatId)` creates it with private permissions. `removeChat` removes sources and previews along with the chat's published visuals. Forks copy the published pages selected by the caller, leaving source files and previews in their original chat.

## Live UI sources

`ChatCoreOptions.intelligentUi` accepts a `ChatUiHost` from `@adecore/agents/chat/ui-queries`. The host captures the writing chat's access and registers a fixed list of `ChatUiSource` entries: argument and result schemas, `authorize`, and an abortable read. Authorization checks both captured and current rights, including before cache hits. The read receives the captured access too.

`ChatUiQueries` compiles against those schemas, freezes the first results and text fallback in metadata, and serves `ui.query` only to clients attached to that chat. It validates stored block identity and input bindings, allows eight queries per block, two concurrent reads per chat and sixteen across the host, bounds result bytes and retained values, and limits each query to one refresh per ten seconds. A timeout aborts the source after eight seconds. A timed-out source keeps its concurrency slot until its actual work stops. No background refresh is scheduled by the daemon.

A fork captures its own chat's rights. Missing or incomplete saved access refuses a read after restart. `ChatCore.choose` supplies only issued query values to the interpreter; the client's read ids do not grant access.
