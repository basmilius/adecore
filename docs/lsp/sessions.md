# Sessions and transports

## Transports

An `LspTransport` sends and receives whole JSON-RPC messages: `send(message)`, `onMessage(listener)`, `onClose(listener)` and `close()`. Messages that arrive before the first listener are kept for it. One transport carries one connection.

| Transport                                  | Over                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `createStreamTransport(stream, options?)`  | A `ByteStream`, such as the stdin and stdout of a server process, with `Content-Length` framing |
| `connectWebSocket(url, options?)`          | A WebSocket, one JSON text frame per message; resolves once the socket is open                |
| `createMemoryTransportPair()`              | From `@adecore/lsp/testing`: two ends in memory, each message JSON-copied and delivered on a microtask |

A `ByteStream` is the app's adapter over a process: `write(chunk)`, `onData`, `onClose` and `close`. Wire stdout to `onData` and keep stderr apart, since a log line in stdout breaks the framing. A frame over `maxMessageBytes` (32 MiB) or one it cannot read closes the stream.

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

`connectWebSocket` takes `protocols`, a `signal` to cancel opening, `timeoutMs` (default 10 seconds) and a `createWebSocket` factory for runtimes without a global `WebSocket`. A binary or non-JSON frame closes the socket. Reconnecting and authentication are the app's job.

## LspSession

`new LspSession(transport, options?)` is one conversation with one server. Await `initialize()` before anything else. It runs the handshake and then sends the `configuration`, if any.

| `LspSessionOptions`      | Default            | Meaning                                                                    |
| ------------------------ | ------------------ | -------------------------------------------------------------------------- |
| `rootUri`                | `null`             | The workspace root                                                         |
| `workspaceFolders`       | from `rootUri`     | The folders of the workspace                                               |
| `clientInfo`             | `@adecore/lsp`     | The name, and a version, the server sees                                   |
| `initializationOptions`  |                    | What the server takes in its handshake                                     |
| `configuration`          | `{}`               | Settings, sent after the handshake and answered to `workspace/configuration` |
| `timeoutMs`              | 30 seconds         | The deadline of a request; `0` turns it off                                |
| `fullSyncDelayMs`        | 200 ms             | How long the changes for a server with full sync gather before the whole text goes out |
| `snippetSupport`         | `false`            | Whether completion items may be snippets                                   |
| `insertTextModes`        | not advertised     | Supported completion insertion modes: `1` as-is, `2` adjusted indentation   |
| `completionItemDefaults` | not advertised     | Completion-list default fields the consumer applies to each item           |
| `resourceOperations`     | `create`, `rename` | The resource operations the host carries out for a workspace edit, announced to servers. A host that also deletes lists `delete`; see [workspace edits](/lsp/documents#workspace-edits) |
| `onConfiguration(item)`  |                    | Answers each configuration item instead of `configuration`                 |
| `onApplyEdit(params)`    | refuses            | Applies a `workspace/applyEdit` of the server                              |
| `onShowMessage(params)`  | `null`             | Answers a `window/showMessageRequest`                                      |
| `onMessage(params)`      |                    | A `window/showMessage` for a person to read                                |
| `onLog(params)`          |                    | A `window/logMessage` line                                                 |
| `onTrace(params)`        |                    | A `$/logTrace` of the server                                               |
| `onTelemetry(data)`      |                    | A `telemetry/event`                                                        |
| `onShowDocument(params)` | refuses            | Shows a document or web address for `window/showDocument`; announced only when set |
| `trace`                  | `off`              | The trace level sent with `initialize`; `setTrace(value)` changes it later |
| `locale`                 |                    | The language of the interface, for the server's messages                   |

Advertise insertion modes and list defaults only when the completion consumer implements them.

Without `onConfiguration`, a query without a section gets all settings, and a section gets that key or dotted path, or `null`. `setConfiguration(settings)` replaces the settings and notifies the server. Answer `onApplyEdit` with `applied: true` only once the edit is made.

`state` goes `new`, `initializing`, `ready`, `closing`, `closed`. A closed session does not restart.

## Completion defaults

`applyCompletionDefaults(item, defaults?)` returns the item with the list defaults filled in. Explicit item fields win. A default edit range takes `textEditText`, then `label`, as its text. Malformed ranges throw `RangeError`, unless you pass `{ onInvalidRange }` as the third argument, which reports the range and keeps the other defaults. Non-string labels or edit text throw `TypeError`. The session advertises insert mode `1` (as-is) by default.

## Capabilities

`supports(method, document?)` says whether the server answers a method, from its static and dynamic registrations, filtered by document selector. `providerOptions(method, document?)` returns that provider's options, such as trigger characters or a semantic tokens legend. Ask for the exact method: `completionItem/resolve` needs `resolveProvider`, `textDocument/prepareRename` needs `prepareProvider`.

`onCapabilitiesChanged(listener)` fires when the server registers or unregisters a capability, and when it asks for a refresh of semantic tokens, inlay hints, diagnostics, code lenses, inline values, folding ranges or document content. Request again whatever depends on it.

The client announces all of LSP 3.17 and the 3.18 additions. `showDocument` is announced only when the host handles it.

## The workspace

| Method                                      | What it does                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `workspaceDiagnostics(previousResultIds?)`  | The problems of every file the server knows, for one that sets `workspaceDiagnostics`; a document it reports `unchanged` keeps what the client had |
| `textDocumentContent(uri)`                  | The text of a document of a scheme the server lists, such as a decompiled class            |
| `changeWorkspaceFolders(event)`             | Adds and removes folders, and tells a server that asked for the changes                    |
| `setTrace(value)`                           | Changes the level of `$/logTrace`                                                          |
| `cancelWorkDoneProgress(token)`             | Asks the server to stop work it reported as cancellable                                    |

## Notebooks

Notebook cells do not go through `openDocument`. `openNotebook(notebook, cellTextDocuments)`, `changeNotebook(notebook, change)`, `saveNotebook(notebook)` and `closeNotebook(notebook, cellUris)` send the `notebookDocument/*` notifications for notebooks the server selects. `syncsNotebook(notebook)` tells whether it does. The editor packages have no notebook view.

## Listening

| Method                          | What it hears                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `onDiagnostics(listener)`       | Published diagnostics of open documents; a report for another version is dropped, and closing a document sends an empty one |
| `onProgress(listener)`          | `$/progress`                                                                   |
| `onNotification(method, listener)` | Any notification of the server                                              |
| `onRequest(method, handler)`    | A request of the server; the handler gets the params and an `AbortSignal`      |
| `onError(listener)`             | Errors of the connection and of listeners                                      |

The session answers configuration, workspace folders, `applyEdit`, message requests, progress creation, registrations and refreshes itself. `request(method, params?, options?)`, `notify(method, params?)`, `executeCommand`, `workspaceSymbols` and `resolveWorkspaceSymbol` reach the server directly.

## Errors

A request rejects with an `LspError` that carries a `code` from `ErrorCodes`, and its `data`:

| Code                   | Value    | Meaning                                                        |
| ---------------------- | -------- | -------------------------------------------------------------- |
| `RequestCancelled`     | `-32800` | Cancelled by a signal or the deadline; `$/cancelRequest` was sent |
| `ContentModified`      | `-32801` | The text changed under the request                             |
| `MethodNotFound`       | `-32601` | The server does not answer this method                         |
| `ServerNotInitialized` | `-32002` | The session is not ready                                       |
| `InvalidRequest`       | `-32600` | The message was not a valid request                            |
| `InternalError`        | `-32603` | Anything else                                                  |

`StaleResultError` is an `LspError` with `ContentModified` and the document's `uri`. Drop it and ask again.

## Shutdown

`shutdown()` closes the documents, sends `shutdown` and `exit` and closes the connection, even when a step fails. A second call returns the same promise. Stopping the process is the app's job.
