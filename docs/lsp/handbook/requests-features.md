# Requests and language results

`JsonRpcConnection` correlates request ids, serializes sends, handles notifications and server requests, and propagates close. It is a protocol connection; `LspSession` adds readiness/capabilities, and `LspDocument` adds synchronization/version checks.

Requests time out after 30 seconds by default. Set `timeoutMs` at connection/session construction or per request; zero removes the deadline. An aborted `signal` or deadline rejects with request-cancelled and sends `$/cancelRequest`. Incoming request handlers receive an `AbortSignal`. An unknown server request receives method-not-found. Notification handler failures go to `onError`.

## Document request policy

A newer request for the same method on the same `LspDocument` cancels the previous one unless `DocumentRequestOptions.cancelPrevious` is `false`. Changes and close cancel all requests. Even if a server ignores cancellation, the document checks its version again before returning a result. Resolved completion items, actions, and hints also carry remembered result-version protection.

`LanguageRequestOptions` uses a higher-level `parallel: true` flag for requests that should coexist. A host `LanguageService` adapter should translate that to `cancelPrevious: false` where it delegates to `LspDocument`, while preserving caller signals. Do not let reference-count requests cancel one another.

| Error                                            | Meaning / host response                                    |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `StaleResultError`, `ContentModified` (`-32801`) | Document changed/closed; discard answer                    |
| `LspError`, `RequestCancelled` (`-32800`)        | Signal or timeout; stop presenting the request             |
| `MethodNotFound` (`-32601`)                      | Feature unavailable; hide/disable its affordance           |
| `ServerNotInitialized` (`-32002`)                | Session/service not ready; wait for provider availability  |
| `InvalidRequest` (`-32600`)                      | Invalid JSON-RPC message                                   |
| `InternalError` (`-32603`)                       | Other client/server failure; preserve details for the host |

`LspError` carries `code` and optional `data`; `StaleResultError` also carries `uri`. Not every transport or host error is an `LspError`. Report actionable failures through host error handling without treating a canceled hover as a user-visible server crash.

## Supported feature families

| Family         | `LspDocument` methods / result mapping                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Completion     | `completion`, `resolveCompletion`; array, `CompletionList`, or `null`                                                       |
| Information    | `hover`, `signatureHelp`; markup and active-signature/parameter data                                                        |
| Navigation     | `definition`, `declaration`, `typeDefinition`, `implementation`; `Location`, location array, location-link array, or `null` |
| Uses           | `references`, `documentHighlights`; positions and optional read/write kind                                                  |
| Symbols        | `documentSymbols`; hierarchy or flat symbol information                                                                     |
| Rename         | `prepareRename`, `rename`; range/placeholder/default behavior and workspace edits                                           |
| Actions        | `codeActions`, `resolveCodeAction`; actions or commands                                                                     |
| Formatting     | `formatting`, `rangeFormatting`; simultaneous `TextEdit[]`                                                                  |
| Classification | Full/delta/range semantic tokens; legend belongs to provider options                                                        |
| Hints          | `inlayHints`, `resolveInlayHint`; string or multipart labels                                                                |
| Structure      | `foldingRanges`, `selectionRanges`, `codeLenses`, `resolveCodeLens`                                                         |
| Diagnostics    | Push session diagnostics and `document.diagnostics` pull reports                                                            |

Sessions additionally expose `executeCommand`, `workspaceSymbols`, and `resolveWorkspaceSymbol`. Document `request(method, params, options)` handles extension feature calls, omitting `textDocument` for ordinary methods and passing items through for resolve methods. Raw session/connection `request` calls do not automatically gain document version checks.

`LanguageService` includes URI-scoped counterparts plus `openDocument`, `changeDocument`, `closeDocument`, `supports`, `providerOptions`, `onProvidersChanged`, and `onDiagnostics`. It does not expose every raw session extension, pull diagnostic, or save operation. Keep unsupported host operations explicit.

Normalize navigation links using `targetUri` and `targetSelectionRange` when selecting a destination; `targetRange` describes surrounding context. Preserve null/empty results as a valid no-result answer. Semantic tokens are delta-encoded integers; use the server legend and a result mapper rather than treating them as colored editor offsets.

The protocol module exports these typed shapes. It does not implement all possible LSP extensions or assert that a particular server supports the whole list. [`editor-react`](/editor-react/handbook/) maps supported results into actual editor decorations and popups.
