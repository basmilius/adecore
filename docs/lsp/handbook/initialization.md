# Initialization and capabilities

`LspSession` moves through `new`, `initializing`, `ready`, `closing`, and `closed`. Call and await `initialize()` before opening documents or sending ordinary requests. Repeated initialization calls share the same promise. A closed session cannot be restarted.

The handshake sends `initialize`, validates UTF-16 position encoding, sends `initialized`, and, if supplied, sends `workspace/didChangeConfiguration` before documents open. A server explicitly selecting another position encoding is rejected and the connection closes. `processId` is `null`; the host owns the process.

## Session options

| `LspSessionOptions`     | Behavior                                                              |
| ----------------------- | --------------------------------------------------------------------- |
| `rootUri`               | Workspace root or `null`                                              |
| `workspaceFolders`      | Explicit folders; otherwise a folder derived from `rootUri`           |
| `clientInfo`            | Defaults to the package client name                                   |
| `initializationOptions` | Server-specific handshake data                                        |
| `configuration`         | Settings sent after initialization and used for configuration queries |
| `timeoutMs`             | Default request deadline, 30 seconds when omitted; zero disables it   |
| `snippetSupport`        | Defaults to `false`; enable only for a snippet-capable caller         |
| `onConfiguration`       | Optional per-item configuration responder                             |
| `onApplyEdit`           | Host workspace-edit responder; default refuses edits                  |
| `onShowMessage`         | Host message/action responder; default returns `null`                 |

Without `onConfiguration`, a query with no section reads all settings; a section reads an exact key or a dotted path, returning `null` when missing. `setConfiguration` replaces settings and notifies the server. Supply per-resource behavior through the callback if a project has distinct configuration scopes.

`workspace/applyEdit` returns `{ applied: false, failureReason }` when no handler is attached. Client capabilities advertise workspace edits only with that handler, and advertise rename resource operations. Do not report `applied: true` before the authorized host operation has completed.

## Provider availability

`supports(method, document?)` requires a ready session and a matching provider. `providerOptions` returns its options or `undefined`. Static server capabilities and dynamic registrations both count; document selectors filter language, URI scheme, and pattern.

Resolve methods require `resolveProvider`. Prepare-rename requires `prepareProvider`. Semantic full, delta, and range methods check the appropriate provider fields. Check the exact method you intend to call rather than a related base feature.

`onCapabilitiesChanged` fires for dynamic register/unregister messages and semantic-token, inlay-hint, diagnostic, or code-lens refresh requests. A `LanguageService` adapter should translate that into `onProvidersChanged(uri)` for affected open documents. Recheck providers and refresh decorations when it fires.

## Diagnostics and server requests

`onDiagnostics` receives reports only for open documents, discarding reports whose explicit version differs from the current document version. Closing a document emits an empty report. Versionless reports cannot prove freshness, so an adapter must preserve their source and apply its own policy if several servers contribute diagnostics.

`onRequest`, `onNotification`, `onProgress`, and `onError` expose server interaction. `RequestHandler` receives unknown params and an `AbortSignal`; validate params before using them. The session already registers standard configuration, edit, message, progress-creation, capability, and refresh handlers. Register extension methods without replacing those responsibilities accidentally.

`shutdown()` is idempotent. It waits for a pending initialization, closes documents, requests `shutdown` with a five-second deadline, sends `exit`, and closes the connection in `finally`. The host still needs to release its process, pipe, or socket resources even if shutdown rejects.
