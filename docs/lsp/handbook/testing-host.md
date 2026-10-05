# Testing and host integration

`FakeLanguageServer` takes one endpoint of a memory transport, answers initialization/shutdown, keeps documents synchronized, records messages in `received`, and responds through `handlers` or `handle(method, handler)`. `paramsOf(method)` returns ordered params. `publishDiagnostics`, `notify`, and `request` exercise server-to-client behavior; `crash` closes the transport. `silent: true` simulates an unanswered handshake.

Use the [in-memory walkthrough](./index#a-complete-in-memory-conversation) for a session check. Add delayed answers to test edit/close races, versioned diagnostics to test filtering, and dynamic capability messages to test refresh. These checks require no executable, network, credentials, or file writes. The source package tests run with `bun run --cwd packages/lsp test`.

For editor-level tests, [`FakeLanguageService`](/editor-react/handbook/lifecycle-testing) avoids the JSON-RPC layer and tests the host/editor contract directly. Choose the layer where the behavior lives: transport chunking belongs in a decoder/session test; popup cancellation belongs in an editor feature test.

## Implementing `LanguageService`

An adapter needs stable document URI identity, reference ownership, and per-document versions. `openDocument` opens or joins an existing document; the supplied text replaces held text on joining. `changeDocument` applies ordered content changes and increments the version once. `closeDocument` releases a client; a shared backend closes the actual server document only after its last owner ends.

The adapter must preserve signals, stale-result rejection, unsupported/not-ready errors, provider options, and server ownership of resolved results. Return `supports` for the current URI and server state. Emit `onProvidersChanged(uri)` when startup, registration, or refresh changes what the document can ask. Dispose event registrations with their owning editor/project.

A diagnostics report needs `uri`, stable `source`, optional `version`, and `diagnostics`. A new report replaces the previous report from that source, so two servers do not erase one another. Reject stale explicit versions before presenting results. Closing a document should clear its reports.

The lower layers do not provide a process-backed multi-server `LanguageService` factory. A host adapter can delegate to `LspDocument`/`LspSession`, but must implement this ownership/routing contract. An editor view should not start its own duplicate document sync when [`ProjectLanguage`](/editor-react/handbook/host-integration) already owns it.

## Disk notifications and renames

`session.watchedFiles()` returns dynamic watchers. Use `watchesFile(watchers, root, path, type)` before `didChangeWatchedFiles`; `type` is 1 created, 2 changed, 3 deleted. String patterns are root-relative or absolute; relative patterns carry their own base URI. Dependency and metadata folders (`node_modules`, `vendor`, `.git`) match only patterns naming that folder explicitly.

`globMatch` is the package's protocol pattern helper, not a filesystem watcher. The host owns the actual watch, coalescing, and path validation. Do not enumerate or forward an entire dependency tree because a server registered `**`.

`fileOperationFilters`, `renamesTaken`, `willRenameFiles`, and `didRenameFiles` filter operations using the original URI, scheme, file/folder kind, and pattern. Ask for pre-rename edits, apply authorized changes, perform the actual rename in the host, then notify the relevant sessions. The package does not move a file itself. A `RenamedFile` includes `directory` so filters can distinguish folders.

## Migration and failures

Keep existing URI, version, diagnostic source, and wire semantics when changing package imports. Do not silently swap incremental changes for simultaneous text edits. Configure snippet support only when the view can handle the package's documented snippet subset. Recreate sessions after transport loss and reopen current text; no replay happens automatically.

If completion is unavailable, inspect readiness and exact provider options before blaming rendering. If stdout framing fails, check that stderr or startup banners did not enter the byte stream. If a result is stale, discard it and request again for current text. If edits cannot be applied, return a refusal reason instead of acknowledging success to the server.

Transferred TypeScript code carries FSL-1.1-MIT from source revision `9729144f0df3f25628f20cc283dee54f8d9e8162`. Native server distribution and runtime policy are separate host/package tasks. No native executable is promised by this client package.
