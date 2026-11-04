# How it fits together

The package runs in three places: the views and the client in the page, the host in the app's backend and a native helper beside it.

## Three layers

| Layer                | Entry point              | Runs in                                 |
| -------------------- | ------------------------ | --------------------------------------- |
| Views and the client | `@adecore/database`      | The page: React 19, in a browser window |
| Host                 | `@adecore/database/host` | The app's backend: Bun or Node          |
| Helper               | `adecore-database`       | A native process the host starts        |

Two entry points import nothing from React or Node, so any layer can use them. `@adecore/database/protocol` holds the message types, and `@adecore/database/testing` the in-memory transport. The platform packages (`@adecore/database-darwin-arm64` and three others) carry the prebuilt helper.

```
page            views, createDatabaseClient(transport)
  |
app channel     ipcMain.handle, a utility process, a WebSocket
  |
backend         createDatabaseHost, spawnHelper
  |
helper          adecore-database, one JSON message per line
  |
server          SQLite file, MySQL or MariaDB
```

The views never talk to a server. They call a [`DatabaseSession`](/database/api/client#databasesession), and the client sends [protocol](/database/guide/protocol) requests through a `DatabaseTransport`, one function from request to response. The app implements it over a channel it already has, such as Electron IPC or a WebSocket.

At the other end, the app hands each request to the [host](/database/api/host). The host checks the request's shape, keeps each owner's sessions apart, asks the app about connections, files and discovery, and forwards to the helper. The package registers no channel, because the app must check the sender first. See [Security](/database/guide/security).

[`DatabaseProvider`](/database/guide/getting-started#databaseprovider) takes `onAction`, `files` and `storage`, so the app decides where a table opens, which file dialog appears and where settings live.

## Why a separate helper

The database drivers live in a Rust binary, not in the backend:

- A driver crash takes down only the helper. The host fails the running requests with `helper-exited` and starts a new helper on the next request.
- The same binary runs under Bun, Node and Electron's utility process, with no native module to rebuild.
- The helper pages rows and cuts long cells to a preview, so the backend never holds a whole table.

## What crosses the wire

Every message is JSON.

- Integers beyond `Number.MAX_SAFE_INTEGER`, decimals, dates and times arrive as text. The column's `kind` says how to read them.
- A long cell arrives as a preview: `{ kind: 'longText', preview, length }` for text and `{ kind: 'binary', hex, length }` for bytes. The `cell` method fetches the whole value.
- Rows come in pages that say whether more follow. Counting rows is a separate, slower request. An export streams rows to a file without passing them through the page.
