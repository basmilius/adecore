# Language service

`LanguageService` is what an editor asks of the language side, in protocol shapes. [`@adecore/editor-react`](/editor-react/project) takes one, and the app implements it over its servers. It can route a document to one or more servers, start servers on demand or reach a remote machine. An `LspSession` is one server. A service covers every server a project's documents can ask.

## The interface

| Group       | Members                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Documents   | `openDocument(document)`, `changeDocument(uri, changes)`, `closeDocument(uri)`                                                  |
| Providers   | `supports(method, uri)`, `providerOptions(method, uri)`, `onProvidersChanged(listener)`                                         |
| Diagnostics | `onDiagnostics(listener)`, with `DiagnosticsReport`s                                                                            |
| Requests    | One per feature of [`LspDocument`](/lsp/documents#requests), with the `uri` first, plus `workspaceSymbols` and `executeCommand` |

These methods are optional, so an older service still fits. A feature checks `supports(...)` and that the method exists before it calls one:

- `onTypeFormatting(uri, position, ch, formatting)`.
- `prepareCallHierarchy`, `incomingCalls(uri, item)` and `outgoingCalls(uri, item)`, where `uri` is the document the hierarchy was prepared in.
- `documentLinks`, `resolveDocumentLink`, `documentColors`, `colorPresentations`, `linkedEditingRanges`, `monikers`, `prepareTypeHierarchy`, `supertypes`, `subtypes`, `inlineValues`, `inlineCompletions`, `rangesFormatting`, `willSave`, `willSaveWaitUntil`, `workspaceDiagnostics(uri, previousResultIds?)` and `textDocumentContent(uri)`, each like the [`LspDocument`](/lsp/documents#requests) or `LspSession` method of that name.
- `onServerMessage(listener)`, which hands over each `ServerMessage`: a `window/showMessage` (`kind: 'show'`) or `window/logMessage` (`kind: 'log'`) with `type`, `message` and `source`.
- `onShowDocument(handler)`, which answers `window/showDocument`.

Every request takes `LanguageRequestOptions`: a `signal`, and `parallel: true` to run requests of one feature side by side instead of cancelling, such as counting references of several declarations. Map it to `cancelPrevious: false` on `LspDocument`.

## What a service promises

- `openDocument` opens the document, or joins it when another client has it open. Its text then replaces what is held. `changeDocument` applies `ContentChange`s in order and raises the version by one. `closeDocument` releases it. A shared service closes the server's document after the last client.
- An answer for outdated text rejects with `StaleResultError`. An unsupported method rejects with an `LspError` of `-32601`, a server that is not up with `-32002`.
- `onProvidersChanged(uri)` fires when a document's server came up, registered a capability or asked for a refresh. Editor features ask once when a document opens, so fire it when a server comes up for an open document.
- A `DiagnosticsReport` has the `uri`, the `source` (which server), an optional `version` and the `diagnostics`. A report replaces the previous one of the same source, so give each server a stable source and send an empty report once its problems are gone.
- A completion item, code action, lens, hint or action command resolves on the server that produced it.

`unservedLanguageService()` is the service for a document no server handles. It accepts documents, supports nothing and rejects every request with an `LspError` of `-32601`.

The package ships no service over processes. A minimal one over a single session forwards each method to the open `LspDocument`, counts clients per URI, and maps `session.onCapabilitiesChanged` and `onDiagnostics` to the two events. Server discovery, installation, starting and permissions stay in the app.

## Vue and TypeScript

A Vue file has two servers: the Vue language server for the template and TypeScript for the scripts. `bridgeVueTypeScript(vue, typescript)` relays the Vue server's `tsserver/request` notifications to TypeScript's `typescript.tsserverRequest` command and sends the answer back (`null` on failure). Attach it before the Vue session initializes. Open each `.vue` document in both sessions, TypeScript first, and dispose the bridge before the sessions. Configure the Vue plugin in the TypeScript server yourself.

```ts
const bridge = bridgeVueTypeScript(vue, typescript);

await typescript.initialize();
await vue.initialize();
```

`vueServerOrder(method, text, params)` says which server to ask first, with the other as fallback. TypeScript goes first inside a `<script>` block, an interpolation, a `v-`, `:` or `@` attribute, and for inlay hints. Vue goes first elsewhere. The check is lexical, not a Vue parser.
