# LSP

`@adecore/lsp` is a Language Server Protocol 3.17 client. It uses no DOM and no Node or Bun APIs, so it runs in a backend, a utility process or a page. It also defines `LanguageService`, the interface the features of [`@adecore/editor-react`](/editor-react/) call. The app starts the server and hands the package a transport to it.

```ts
import { LspSession, pathToFileUri } from '@adecore/lsp';

const session = new LspSession(transport, { rootUri: pathToFileUri('/work') });
await session.initialize();

const document = session.openDocument({ uri: pathToFileUri('/work/example.ts'), languageId: 'typescript', text });
const hover = await document.hover({ line: 0, character: 6 });
```

## What it does

- Frames JSON-RPC over a byte stream, such as a server's stdin and stdout, or over a WebSocket.
- Runs the handshake, answers the server's configuration, registration and progress requests, and shuts down cleanly.
- Keeps each open document's text and version, and sends only what changed, or the whole text to a server that asks for full sync.
- Cancels a request when a newer one of the same feature starts or the text changes, and rejects an answer for old text.
- Applies both kinds of protocol edit to a string, and plans a workspace edit across files without touching one.
- Relays the requests a Vue language server sends to TypeScript.

## What it leaves to the app

The package spawns no process and touches no file. The app finds, installs and starts the server, wires its streams to a transport and stops it after shutdown. It reads and writes files, watches the disk, checks permissions before it applies a workspace edit, and keeps drafts of unsaved text. It decides which servers a document goes to and implements the `LanguageService` the editor asks.

## Where to next

- [Getting started](/lsp/getting-started) starts a server, opens a document and hands a language service to the editor.
- [Transports](/lsp/transports) covers the stream, WebSocket and memory transports.
- [Sessions](/lsp/sessions) covers the handshake, options, capabilities, the workspace, server messages, errors and shutdown.
- [Documents and requests](/lsp/documents) covers `LspDocument`, its requests and how stale answers are caught.
- [Edits](/lsp/edits) covers the edit helpers and planning workspace edits.
- [Files](/lsp/files) covers URIs, watched files and file operations.
- [Language service](/lsp/language-service) covers the interface between editor features and a project's servers, and the Vue and TypeScript pair.
- [Testing](/lsp/testing) covers `FakeLanguageServer` and a memory transport.
- [Reference](/lsp/reference) lists every export.

Positions are zero-based lines and UTF-16 characters. The edit helpers end a line at `\n`, `\r\n` or a lone `\r`, like [`@adecore/editor-core`](/editor-core/documents#text-and-lines).

## Limits

- The client offers only the UTF-16 position encoding. A server that picks another fails to initialize.
- Workspace edits declare no change annotations.
- The session passes on diagnostics without a version while their document is open.
- A server that negotiated no document sync cannot follow edits, so `applyChanges` rejects.
- A session does not reconnect. After the transport closes, start a new session and reopen the documents.

The package is FSL-1.1-MIT.
