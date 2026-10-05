# Transports and host processes

`LspTransport` sends and receives complete JSON-RPC messages. `send(message)` and `close()` may be synchronous or async. `onMessage(listener)` and `onClose(listener)` return `Disposable` subscriptions. Do not attach two independent `JsonRpcConnection` instances to the same transport.

The provided transports buffer messages that arrive before a listener attaches. The first listener drains that backlog. Closing a transport ends pending connection work; messages are not durable or replayed across reconnects.

## Stdio framing

`createStreamTransport(stream, { maxMessageBytes? })` adapts a host `ByteStream`. The host supplies `write(Uint8Array)`, `onData`, `onClose`, and `close`. Connect language-server stdout to `onData` and write to its stdin. Keep stderr separate as host log data; mixing it into framed stdout corrupts the protocol.

The stream contract does not spawn or authorize a child. It must preserve byte order, provide backpressure through an awaited `write`, and make `close` terminate or release the host resource. The host also decides how child exit becomes `onClose` and how to remove its own event listeners.

`encodeMessage` writes `Content-Length` in UTF-8 bytes followed by CRLF framing. `ContentLengthDecoder.accept(chunk)` handles split headers/bodies and several messages in a chunk. The default maximum body is 32 MiB and the maximum header is 8,192 bytes. Missing/invalid length, oversized input, or invalid JSON throws; discard that decoder after a framing error. `createStreamTransport` closes the stream on such an error.

```ts
import { ContentLengthDecoder, encodeMessage } from '@adecore/lsp';

const message = { jsonrpc: '2.0' as const, method: 'example', params: { label: '😀' } };
const bytes = encodeMessage(message);
const decoder = new ContentLengthDecoder();
console.assert(decoder.accept(bytes.subarray(0, 12)).length === 0);
const decoded = decoder.accept(bytes.subarray(12));
console.assert(JSON.stringify(decoded[0]) === JSON.stringify(message));
```

## WebSocket

`connectWebSocket(url, options?)` returns a transport after opening a socket. It uses one JSON text frame per message, with no Content-Length wrapper. Binary frames and invalid JSON close the socket. The connection timeout defaults to 10 seconds. A provided `AbortSignal` can cancel opening; after opening, close the returned transport to end it.

`WebSocketTransportOptions` accepts subprotocols, timeout, signal, and an injected `createWebSocket`. Browser code needs the browser WebSocket API; Node/Bun hosts need a compatible global or factory. There is no reconnect or authentication workflow. The host authorizes the endpoint, provides credentials through its chosen transport policy, and starts a new session after reconnecting.

Sending rejects when the socket is closed/not open or its buffered amount already exceeds 8 MiB. Monitor request errors and transport close rather than assuming a connected socket remains usable.

## Memory transport

`createMemoryTransportPair()` returns two `LspTransport` endpoints. A send JSON-clones the message and delivers it on a microtask. Closing either closes both. This tests protocol sequencing without a pipe, network, or installed server. It deliberately does not preserve object identity or non-JSON values.

## Host process responsibility

Installation, executable selection, project ownership, environment filtering, working directory, permissions, logs, crash policy, and process termination belong to the host. Initialize only after the approved process/transport is usable. On normal teardown, close documents and call `session.shutdown`; on a crash, discard the session and rebuild it over a new transport.

Keep IPC sender checks and endpoint authorization at the application boundary. A transport is a protocol adapter, not evidence that a requesting renderer may start a process or apply a filesystem change. See the [host testing chapter](./testing-host) for a no-process integration check.
