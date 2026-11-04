# Protocol

A client and a host exchange four kinds of frame. The envelope names the request or event, and [the tables](/agent-contracts/requests) describe its payload. Check both, because the envelope parsers leave `payload` and `result` as `unknown`.

| Frame   | Shape                                                         | Type |
| ------- | ------------------------------------------------------------- | --- |
| Request | `{ id, type, payload }`                                       | `Request` |
| Success | `{ id, ok: true, result }`                                    | `ReplyOk` |
| Failure | `{ id: string \| null, ok: false, error: { code, message } }` | `ReplyError` |
| Event   | `{ type: 'event', event, payload }`                           | `Event` |

`Reply` is a success or a failure, and `ServerFrame` is a reply or an event: everything a host sends. A request's `id` and `type` are nonempty strings. A failure has a `null` id when the host could not read the request. `WireError` is `{ code, message }`. Branch on the code and show the message.

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

`parseRequest` and `parseServerFrame` return `{ ok: true, value }` or `{ ok: false, message }` and never throw. An unknown request name still parses as a frame, and the host refuses it. The parsers check against `RequestSchema` and `ServerFrameSchema`, which build on `EventSchema` and on `ReplySchema`, the union of `ReplyOkSchema` and `ReplyErrorSchema`. `ErrorSchema` checks the `WireError` a failure carries. `ParseResult<T>` is what both parsers return.

## FramePort

Two ends that pass frames, such as a `MessagePort` between a window and the chat process:

```ts
interface FramePort {
    send(frame: Request | ServerFrame): void;
    onFrame(listener: (frame: unknown) => void): () => void;
}
```

A frame arrives as `unknown` because the receiver checks it. `onFrame` returns an unsubscribe function. The port knows nothing of connecting, closing, timeouts or who is on the other end. The implementation decides. Pass frames as they are over a cloning port, or as JSON over a socket. [Getting started](/agent-contracts/getting-started#implement-a-port) wraps a `MessagePort` and serves both ends.

## Attaching and replay

`ChatEvent` is a union on `type`:

| `type`  | Effect                                                                              |
| ------- | ----------------------------------------------------------------------------------- |
| `item`  | Insert or replace the item with this id. `historyIndex` places it in a paged thread. |
| `delta` | Append `text` to the item `itemId`: a reply, a thought, or the output of a running tool. |
| `info`  | Replace the chat's `ChatInfo`.                                                      |
| `reset` | Replace the info and the whole thread.                                              |

`ChatEventSchema` is that union, and `ChatEventEnvelopeSchema` the `chat.event` payload around it: `{ chatId, event, seq? }`.

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

`activeSubagents(items)` returns the subagents still relevant beside a thread: running ones, ones settled after the last message, and settled ones whose turn still runs another. A client holding only the newest page shows those next to it.

`activeWorkflows(items)` returns the Workflow calls still relevant beside a thread by the same rule: running ones and ones that ended after the last message, counting only calls that reported what they run. `finishedAt` on a workflow is when its call settled. `workflowEndedAt(workflow)` returns that moment. For a call stored without it, the function falls back to the last end of its agents or its last report, and returns null when the call never reported. A client holding only the newest page keeps these next to it too, and applies the events that change them.

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

Keep the agent names and shapes unchanged, so clients written against the tables keep working. Some contracts stay out of the tables on purpose and compose the same way: a terminal agent's status and approvals in `/agent` (see [Providers and models](/agent-contracts/providers#terminal-agents)) and `TaskChangedEventSchema` in `/task` (see [Tasks and worktrees](/agent-contracts/tasks)).

## Changing a contract

A client may validate a whole thread at once, and one unknown item kind or enum value rejects all of it. So a contract grows only by optional fields, never by a new item kind or a new value in an existing enum. The tables have no version field. An app that needs one puts it in its own protocol.

Renaming the package changes no wire names or stored shapes. One legacy value stays for that reason: the second value of `origin` on a subagent item, which names a host that opened it with its own task. Read it from [`HOST_TASK_ORIGIN`](https://github.com/basmilius/adecore/blob/main/packages/agent-contracts/src/chat.ts), which `ChatSubagentItemSchema` accepts, and write it back unchanged.
