# Server and document lifecycle

The native server speaks LSP over stdin/stdout. The host owns the process, its authorized executable and each project's shutdown policy. The Node locator does not create a connection or register an editor language service.

## Framing and initialization

Each JSON-RPC message needs a `Content-Length` header counting UTF-8 bytes, followed by `\r\n\r\n` and the JSON body. Do not count JavaScript string characters or mix log output into stdout.

```ts
export function encodeLspMessage(message: unknown): Buffer {
    const body = Buffer.from(JSON.stringify(message), 'utf8');
    const header = Buffer.from(`Content-Length: ${body.byteLength}\r\n\r\n`, 'ascii');
    return Buffer.concat([header, body]);
}
```

Use an existing LSP client for full transport management, response ids, cancellation and editor synchronization. The framing function above is only an encoder, not a client.

Send `initialize`, read its response, then send `initialized`. This request is a minimal useful client shape; substitute your authorized workspace URI and paths:

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "processId": null,
        "rootUri": "file:///project",
        "capabilities": {
            "general": { "positionEncodings": ["utf-8", "utf-16"] },
            "textDocument": { "documentSymbol": { "hierarchicalDocumentSymbolSupport": true } }
        },
        "initializationOptions": { "phpVersion": "8.4" }
    }
}
```

The server chooses UTF-8 when offered, otherwise UTF-16. Use the returned encoding for every edit, range and cursor position. Document sync is incremental with open/close support. If the client supports hierarchical symbols it receives nested symbols; otherwise the server returns flat symbols.

Additional capabilities activate configuration requests, dynamic watched-file registration, work progress and refresh requests. Answer server requests such as `workspace/configuration` and `client/registerCapability` through your client. Advertising support without implementing the response path can leave indexing/settings/watch behavior incomplete.

## Documents and diagnostics

Send `textDocument/didOpen` with URI, language id, version and full text. Later `didChange` events carry increasing document versions and full or ranged content changes in the negotiated encoding. Open text overrides the disk index. Send `didClose` when the document leaves the host's open-document set.

The implementation applies edits and reparses the whole file, while processing queued changes before diagnostics. Do not describe this as incremental syntax-tree patching merely because LSP sync is incremental.

Without client pull-diagnostic support, findings arrive through `textDocument/publishDiagnostics` after queued changes settle. A client announcing pull diagnostics uses `textDocument/diagnostic` and receives no push findings. Syntax, language-level and inspection findings share that channel. Zero-width ranges are widened for display.

## Projects and watched files

Workspace folders take precedence, with `rootUri` as a fallback. Folders can be added and removed with `workspace/didChangeWorkspaceFolders`. A workspace with `composer.json` is one project. A folder without one searches up to four levels for Composer subprojects, skipping vendor/node_modules/dot/backup folders; a file uses its deepest containing project. Each project keeps its own packages, level and cache.

The dynamic watch list includes PHP files, `composer.json`, `vendor/composer/installed.json`, `.env` variants, language/translation/template folders, config YAML/XML and SQL schema dumps. Send `workspace/didChangeWatchedFiles` for changes when your host owns watching. Ordinary file changes update the index; Composer changes can rebuild project discovery and indexing. Framework readers inspect environment variable names, not values.

Indexing runs in background batches and reports `$/progress` when supported. Features become more complete as project/vendor/stub indexing finishes. Avoid starting several independent server processes for the same project's cache unless the host explicitly supports that policy.

## Shutdown and failures

Send `shutdown`, await its `null` response, then send `exit` and close stdin. Await process exit and capture stderr. Keep a bounded host timeout and terminate a stuck process through the host's process policy. Disposing an editor view alone is not a language-server shutdown.

Transport failure, invalid native executable, server error response and a feature returning `null` are different outcomes. Preserve error response messages for rename/refactor refusals. A `null` hover or format result often means the server has no applicable result, not that the process failed.

Use [the handshake](/php-language-server/handbook/maintainers#fixture-and-handshake-validation) to isolate framing/initialization from editor integration. Keep installation, custom-server permission checks, cache location and per-project process ownership in the host during migration.
