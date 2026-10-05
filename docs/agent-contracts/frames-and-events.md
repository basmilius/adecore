# Frames and events

The envelope describes a message; the protocol table describes its payload. Validate both. `parseRequest` and `parseServerFrame` only check envelopes and leave `payload` or `result` as `unknown`.

| Frame   | Shape                                                         |
| ------- | ------------------------------------------------------------- |
| Request | `{ id, type, payload }`                                       |
| Success | `{ id, ok: true, result }`                                    |
| Failure | `{ id: string \| null, ok: false, error: { code, message } }` |
| Event   | `{ type: 'event', event, payload }`                           |

A request id and type must be nonempty strings. A failure may use a null id when no usable request id arrived. Request ids are correlation values, not permissions or durable chat ids. `WireError` carries a code for caller logic and a message for display.

```ts
import { AGENT_REQUEST_SCHEMAS, parseRequest } from '@adecore/agent-contracts';

const frame = parseRequest({ id: 'request-1', type: 'chat.send', payload: { chatId: 'chat-1', text: 'Hello' } });
if (!frame.ok) {
    throw new Error(frame.message);
}
if (frame.value.type === 'chat.send') {
    const payload = AGENT_REQUEST_SCHEMAS['chat.send'].payload.parse(frame.value.payload);
}
```

An envelope with an unknown request name still parses. The host checks membership in its table, then validates the selected payload. A client correlates each success with the original request and validates that request's result schema.

## Transport ownership

`FramePort` has two methods:

```ts
interface FramePort {
    send(frame: Request | ServerFrame): void;
    onFrame(listener: (frame: unknown) => void): () => void;
}
```

`onFrame` returns a listener release function. The interface specifies no connection establishment, timeout, close operation, authentication, or reconnection. The host and client adapters own those behaviors. Send structured frames over a message port, or serialize them to JSON on a socket. Do not serialize schema objects. See the backend's [transport walkthrough](../agents/transport).

## Request groups

These names are the complete agent request table. A contract's presence does not mean every host implements the operation. A plain `AgentHost` refuses the placement-dependent fork and continuation operations.

| Flow                         | Request names                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Open and read                | `chat.create`, `chat.list`, `chat.attach`, `chat.detach`, `chat.history`                              |
| Send and control             | `chat.send`, `chat.unqueue`, `chat.sendNow`, `chat.cancel`, `chat.compact`, `chat.clear`, `chat.kill` |
| Answer requests              | `chat.approve`, `chat.answer`, `chat.dismiss`                                                         |
| Configuration                | `chat.configure`, `chat.setPreferences`, `skills.list`, `provider.list`                               |
| Checkpoints and continuation | `chat.turnDiff`, `chat.fork`, `chat.forkInfo`, `chat.summarize`, `chat.continueOn`                    |
| Delegated work               | `chat.subagent`, `chat.stopSubagent`, `chat.stopTask`                                                 |
| Bookmarks                    | `chat.addBookmark`, `chat.renameBookmark`, `chat.removeBookmark`                                      |
| Accounts                     | `accounts.list`, `accounts.save`, `accounts.refresh`, `accounts.create`, `accounts.watchLogin`        |
| Usage                        | `usage.summary`, `usage.subscribe`, `usage.unsubscribe`, `usage.limits`, `usage.refreshLimits`        |

The [protocol source](https://github.com/basmilius/adecore/blob/main/packages/agent-contracts/src/protocol.ts) pairs every name with its payload and result schema.

## Event delivery and replay

| Event name             | How a client uses it                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `chat.event`           | Apply a `ChatEvent` to an attached thread                                                        |
| `chat.status`          | Replace the chat's `ChatInfo`, including compact pending requests; sent to all connected clients |
| `chat.subagentChanged` | Fetch the watched subagent page again; it carries no conversation text                           |
| `chat.bookmarks`       | Replace the attached chat's whole bookmark list                                                  |
| `accounts.changed`     | Replace the account snapshot                                                                     |
| `usage.changed`        | Ask for the currently displayed period again                                                     |
| `usage.limitsChanged`  | Replace the plan limit snapshot                                                                  |

`ChatEvent` is a union on `type`. An `item` upserts by item id, a `delta` appends text to `itemId`, an `info` replaces metadata, and a `reset` replaces the conversation. Item events may include a `historyIndex`.

`chat.attach` returns `info` and `items`. It may also return `history`, `pending`, `bookmarks`, and a `seq`. Keep the latest applied sequence and pass it as `since` on reconnect. If replay is available, the response has an empty `items` array and ordered `events`. Otherwise it supplies a snapshot. Replace local content on that fallback; appending it would duplicate the conversation. Sequence fields remain optional for older hosts.

History limits are integers from 1 to 100. A cursor is opaque: pass it back unchanged. `chat.history` requires a cursor of at most 128 characters. Subagent cursors allow 256. A stale history cursor may produce `history-expired`; reattach for a new snapshot.

Terminal session status and approval schemas in `/agent`, and `TaskChangedEventSchema` in `/task`, are separate contracts. They are available for host protocol composition and are not entries in `AGENT_EVENT_SCHEMAS`.
