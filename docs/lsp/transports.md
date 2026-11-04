# Transports

An `LspTransport` sends and receives whole JSON-RPC messages: `send(message)`, `onMessage(listener)`, `onClose(listener)` and `close()`. The transport holds messages that arrive before the first listener and hands them to it. One transport carries one connection, and a session owns it from `new LspSession(transport)` on.

| Transport                                 | Over                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `createStreamTransport(stream, options?)` | A `ByteStream`, such as the stdin and stdout of a server process, with `Content-Length` framing         |
| `connectWebSocket(url, options?)`         | A WebSocket, one JSON text frame per message; resolves once the socket is open                          |
| `createMemoryTransportPair()`             | From `@adecore/lsp/testing`: two ends in memory, each message JSON-copied and delivered on a microtask |

## A server process

A `ByteStream` is the app's adapter over a process: `write(chunk)`, `onData`, `onClose` and `close`. Wire stdout to `onData` and keep stderr apart, since a log line in stdout breaks the framing.

```ts
import { spawn } from 'node:child_process';
import { createStreamTransport, type ByteStream } from '@adecore/lsp';

const child = spawn(executable, ['--stdio'], { cwd: projectFolder });

const stream: ByteStream = {
    write: (chunk) => void child.stdin.write(chunk),
    onData: (listener) => {
        child.stdout.on('data', listener);
        return { dispose: () => child.stdout.off('data', listener) };
    },
    onClose: (listener) => {
        const exited = (): void => listener();
        child.once('exit', exited);
        return { dispose: () => child.off('exit', exited) };
    },
    close: () => void child.kill()
};

const transport = createStreamTransport(stream);
child.stderr.on('data', (chunk) => log(String(chunk)));
```

A frame over `maxMessageBytes` (32 MiB by default) or one it cannot read closes the stream. Pass another limit as `createStreamTransport(stream, { maxMessageBytes })`.

## A WebSocket

`connectWebSocket` suits a server on another machine or behind a proxy that speaks one message per frame. Its `WebSocketTransportOptions` take `protocols`, a `signal` to cancel opening, `timeoutMs` (default 10 seconds) and a `createWebSocket` factory for runtimes without a global `WebSocket`.

```ts
import { connectWebSocket, LspSession } from '@adecore/lsp';

const transport = await connectWebSocket('wss://tools.example.com/lsp/php', { timeoutMs: 5_000 });
const session = new LspSession(transport, { rootUri });
```

A binary or non-JSON frame closes the socket. Reconnecting and authentication are the app's job.

## In memory

`createMemoryTransportPair()` returns two connected ends, so a session and a fake server talk in a test without a process. See [Testing](/lsp/testing).
