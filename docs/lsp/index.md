# @adecore/lsp

A Language Server Protocol 3.17 client that uses no DOM and no Node or Bun APIs, so it runs in a backend, a utility process or a page. It also defines `LanguageService`, the interface [`@adecore/editor-react`](/editor-react/) features call. The app starts the server and hands the package a transport.

```ts
import { LspSession, pathToFileUri } from '@adecore/lsp';

const session = new LspSession(transport, { rootUri: pathToFileUri('/work') });
await session.initialize();

const document = session.openDocument({ uri: pathToFileUri('/work/example.ts'), languageId: 'typescript', text });
const hover = await document.hover({ line: 0, character: 6 });
```

```sh
bun add @adecore/lsp
```

## What is in it

- [Sessions and transports](/lsp/sessions): `LspSession`, the handshake, capabilities, configuration and shutdown, over stdio, a WebSocket or memory.
- [Documents and edits](/lsp/documents): `LspDocument`, requests, stale answers, edit helpers, workspace edits and file operations.
- [Language service](/lsp/language-service): the interface between editor features and a project's servers, and a Vue and TypeScript pair.
- [Testing](/lsp/testing): `FakeLanguageServer` and a memory transport.

Positions are zero-based lines and UTF-16 characters. The edit helpers end a line at `\n`, `\r\n` or a lone `\r`, like [`@adecore/editor-core`](/editor-core/documents#text-and-lines).

## Limits

- Only the UTF-16 position encoding is offered. A server that picks another fails to initialize.
- Workspace edits declare no change annotations.
- Diagnostics without a version are passed on while their document is open.
- The package touches no file. It plans workspace edits and leaves applying them to the host (see [workspace edits](/lsp/documents#workspace-edits)).
- A server that negotiated no document sync cannot follow edits, so `applyChanges` rejects.
- A session does not reconnect. After the transport closes, start a new session and reopen the documents.

The package is FSL-1.1-MIT.
