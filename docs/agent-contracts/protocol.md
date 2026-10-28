# Protocol

A client and a host exchange four kinds of frame. The envelope names the request or event, and the tables describe its payload. Check both, because the envelope parsers leave `payload` and `result` as `unknown`.

| Frame   | Shape                                                         |
| ------- | ------------------------------------------------------------- |
| Request | `{ id, type, payload }`                                       |
| Success | `{ id, ok: true, result }`                                    |
| Failure | `{ id: string \| null, ok: false, error: { code, message } }` |
| Event   | `{ type: 'event', event, payload }`                           |

A request's `id` and `type` are nonempty strings. A failure has a `null` id when the host could not read the request. `WireError` is `{ code, message }`. Branch on the code and show the message.

```ts
import { AGENT_REQUEST_SCHEMAS, parseRequest } from '@adecore/agent-contracts';

const frame = parseRequest(incoming);
if (!frame.ok) {
    throw new Error(frame.message);
}
if (frame.value.type === 'chat.send') {
    const payload = AGENT_REQUEST_SCHEMAS['chat.send'].payload.parse(frame.value.payload);
}
```

`parseRequest` and `parseServerFrame` return `{ ok: true, value }` or `{ ok: false, message }` and never throw. An unknown request name still parses as a frame, and the host refuses it. `RequestSchema`, `ReplySchema`, `ReplyOkSchema`, `ReplyErrorSchema`, `EventSchema`, `ServerFrameSchema` and `ErrorSchema` are the schemas behind them, and `ParseResult<T>` is the result type.

## FramePort

Two ends that pass frames, such as a `MessagePort` between a window and the chat process:

```ts
interface FramePort {
    send(frame: Request | ServerFrame): void;
    onFrame(listener: (frame: unknown) => void): () => void;
}
```

A frame arrives as `unknown` because the receiver checks it. `onFrame` returns an unsubscribe function. The port knows nothing of connecting, closing, timeouts or who is on the other end. The implementation decides. Pass frames as they are over a cloning port, or as JSON over a socket.

## Requests

`AGENT_REQUEST_SCHEMAS` maps every request name to `{ payload, result }`. `AgentRequestType` is the union of its names.

| Group                  | Requests                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| Open and read          | `chat.create`, `chat.list`, `chat.attach`, `chat.detach`, `chat.history`, `chat.toolOutput`           |
| Send and control       | `chat.send`, `chat.unqueue`, `chat.sendNow`, `chat.cancel`, `chat.compact`, `chat.clear`, `chat.restart`, `chat.kill` |
| Answer                 | `chat.approve`, `chat.answer`, `chat.dismiss`                                                         |
| Configure              | `chat.configure`, `chat.setPreferences`, `skills.list`, `provider.list`                               |
| Turns and forks        | `chat.turnDiff`, `chat.fork`, `chat.forkInfo`, `chat.summarize`, `chat.continueOn`                    |
| Delegated work         | `chat.subagent`, `chat.stopSubagent`, `chat.stopTask`, `chat.goal`                                    |
| Bookmarks              | `chat.addBookmark`, `chat.renameBookmark`, `chat.removeBookmark`                                      |
| Visuals                | `chat.removeVisual`                                                                                   |
| Accounts               | `accounts.list`, `accounts.save`, `accounts.refresh`, `accounts.create`, `accounts.watchLogin`        |
| Usage                  | `usage.summary`, `usage.subscribe`, `usage.unsubscribe`, `usage.limits`, `usage.refreshLimits`        |

Not every host implements every request. A host that only runs chats refuses the fork requests with `chat-unsupported` (see [Host](/agents/host#what-a-plain-host-refuses)). Requests without a payload or result use `EmptySchema`, `{}`.

`accounts.refresh` answers once every CLI was asked again. `accounts.watchLogin` answers at once, and later results arrive as `accounts.changed`.

## Events

`AGENT_EVENT_SCHEMAS` maps every event name to its payload schema. `AgentEventType` is the union of its names.

| Event                  | Payload and what a client does with it                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `chat.event`           | `{ chatId, event, seq? }`: apply the `ChatEvent` to a thread the client attached.                |
| `chat.status`          | `{ chatId, info }`: the chat's whole `ChatInfo`, to every client, attached or not.               |
| `chat.subagentChanged` | `{ chatId, toolUseId }`: ask for the watched subagent page again. It carries no conversation.    |
| `chat.bookmarks`       | `{ chatId, bookmarks }`: the attached chat's whole bookmark list.                                |
| `chat.visuals`         | `{ chatId, visuals }`: the attached chat's whole list of [visuals](/agent-contracts/visuals).    |
| `accounts.changed`     | The whole account snapshot.                                                                      |
| `usage.changed`        | `{ scannedAt }`: ask for the period on screen again.                                             |
| `usage.limitsChanged`  | The whole plan limit snapshot.                                                                   |

`chat.status` goes to every client, so a chat waiting on a person shows it everywhere. `info.requests` carries a card-sized summary of the waiting approvals and questions.

## Attaching and replay

`ChatEvent` is a union on `type`:

| `type`  | Effect                                                                              |
| ------- | ----------------------------------------------------------------------------------- |
| `item`  | Insert or replace the item with this id. `historyIndex` places it in a paged thread. |
| `delta` | Append `text` to the item `itemId`: a reply, a thought, or the output of a running tool. |
| `info`  | Replace the chat's `ChatInfo`.                                                      |
| `reset` | Replace the info and the whole thread.                                              |

`chat.attach` returns `{ info, items }` and may add:

| Field | Holds |
| --- | --- |
| `history` | Where the page starts, and the cursor before it |
| `pending` | Every request still waiting, wherever it is in the thread |
| `subagents` | Sub-agents from before the page, as `activeSubagents` names them |
| `workflows` | Workflow calls from before the page, as `activeWorkflows` names them |
| `outline` | The thread before the page, as `outlineItems` cuts it |
| `bookmarks`, `visuals`, `seq` | The lists, and the last event sequence number |

Keep the last `seq` applied and send it as `since` on reconnect. A host that still holds every later event returns them as `events`, with an empty `items`. Otherwise it returns a fresh snapshot. Replace the thread with that snapshot, since appending it duplicates the conversation. An older host without `seq` always returns a snapshot.

`activeSubagents(items)` returns the sub-agents still relevant beside a thread: running ones, ones settled after the last message, and settled ones whose turn still runs another. A client holding only the newest page shows those next to it.

`activeWorkflows(items)` returns the Workflow calls still relevant beside a thread by the same rule: running ones and ones that ended after the last message, counting only calls that reported what they run. `finishedAt` on a workflow is when its call settled. `workflowEndedAt(workflow)` returns that moment, falling back to the last end of its agents or its last report for a call stored without it, and null for one that never reported. A client holding only the newest page keeps these next to it too, and applies the events that change them.

`outlineItems(items, marked)` returns the scrubber stops: every message of the person, every turn woken by tasks or messages, and the replies in `marked`, with text cut to `CHAT_OUTLINE_TEXT_CHARS`. A client holding only the newest page draws a tick for each and loads earlier pages when one is picked.

`historyLimit` and `limit` are whole numbers from 1 to 100. Treat a cursor as opaque. A host that no longer knows a cursor refuses with `history-expired`, and the client attaches again.

## Adding requests

An app places the agent tables inside its own protocol, beside its own requests:

```ts
import { z } from 'zod';
import { AGENT_EVENT_SCHEMAS, AGENT_REQUEST_SCHEMAS } from '@adecore/agent-contracts';

const requests = {
    ...AGENT_REQUEST_SCHEMAS,
    'document.read': { payload: z.object({ id: z.string().min(1) }), result: z.object({ text: z.string() }) }
};

const events = {
    ...AGENT_EVENT_SCHEMAS,
    'document.changed': z.object({ id: z.string().min(1) })
};
```

Keep the agent names and shapes unchanged, so clients written against the tables keep working. Some contracts stay out of the tables on purpose and compose the same way: a terminal agent's status and approvals in `/agent` (see [Providers and accounts](/agent-contracts/providers-and-accounts#terminal-agents)) and `TaskChangedEventSchema` in `/task`.

## Changing a contract

A client may validate a whole thread at once, and one unknown item kind or enum value rejects all of it. So a contract grows only by optional fields, never by a new item kind or a new value in an existing enum. The tables have no version field. An app that needs one puts it in its own protocol.

Renaming the package changes no wire names or stored shapes. One legacy value stays for that reason: the second value of `origin` on a subagent item, which names a host that opened it with its own task. Read it from [`HOST_TASK_ORIGIN`](https://github.com/basmilius/adecore/blob/main/packages/agent-contracts/src/chat.ts), which `ChatSubagentItemSchema` accepts, and write it back unchanged.
