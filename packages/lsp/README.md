# @adecore/lsp

[![npm](https://img.shields.io/npm/v/@adecore/lsp)](https://www.npmjs.com/package/@adecore/lsp)
[![Docs](https://img.shields.io/badge/docs-adecore.dev-blue)](https://adecore.dev/lsp/)

A client for the Language Server Protocol 3.17, without a DOM and without Node or Bun APIs, so it runs in a backend, a utility process or a page. It also defines `LanguageService`, the interface [`@adecore/editor-react`](https://adecore.dev/editor-react/) asks its features through. It starts no server: the app hands it a transport.

## Install

```sh
bun add @adecore/lsp
```

## Use

```ts
import { LspSession, createStreamTransport, pathToFileUri } from '@adecore/lsp';

const session = new LspSession(createStreamTransport(stream), { rootUri: pathToFileUri('/work') });
await session.initialize();

const document = session.openDocument({ uri: pathToFileUri('/work/example.ts'), languageId: 'typescript', text });
await document.updateText(nextText);
const hover = await document.hover({ line: 0, character: 6 });
```

An answer for a text that changed in the meantime rejects with `StaleResultError`.

## Entry points

| Import | What it holds |
|---|---|
| `@adecore/lsp` | `LspSession`, `LspDocument`, the transports, the edit and URI helpers, the Vue bridge and the protocol types |
| `@adecore/lsp/testing` | `FakeLanguageServer` and `createMemoryTransportPair` |

## Documentation

| Page | What it covers |
|---|---|
| [Sessions and transports](https://adecore.dev/lsp/sessions) | Stdio, WebSocket and memory transports, the handshake, capabilities and errors |
| [Documents and edits](https://adecore.dev/lsp/documents) | Versions, requests, stale answers, edit helpers, workspace edits and renames |
| [Language service](https://adecore.dev/lsp/language-service) | The interface for editor features, and Vue with TypeScript |
| [Testing](https://adecore.dev/lsp/testing) | A fake server in memory |

## License

FSL-1.1-MIT
