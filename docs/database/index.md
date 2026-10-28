# @adecore/database

Browse, query and edit SQLite and MySQL or MariaDB databases from a desktop app. The package has React views for the page, a host for the app's backend and a native helper that talks to the servers.

```tsx
import { DatabaseWorkbench } from '@adecore/database';
```

<Demo src="database/workbench" fill />

The demos run on [`fakeDatabaseTransport`](/database/api/testing), an in-memory shop. An edited cell stays until the page reloads. The fake runs no SQL beyond `SELECT * FROM <table>`, so the console, filters and the designer's Apply only look real.

## What is in it

- [`ConnectionManager`](/database/views/connection-manager) and [`ConnectionForm`](/database/views/connection-manager#connectionform) edit the saved connections: SQLite files, and MySQL or MariaDB servers over TCP, a socket, SSH or a Docker container.
- [`DatabaseExplorer`](/database/views/explorer) is a tree of connections, schemas, tables and columns.
- [`TableView`](/database/views/table-view) shows the rows of a table, with filters, editing, a record view, a value panel, and export and import.
- [`StructureView`](/database/views/structure-view) shows the structure of a table, and [`TableDesigner`](/database/views/table-designer) creates and alters one.
- [`QueryConsole`](/database/views/query-console) runs SQL, with history, paging, transactions and export.
- [`DatabaseWorkbench`](/database/views/workbench) puts the explorer beside tabs for all of these. An app with its own tabs answers the [actions](/database/guide/tabs) of the views instead.
- [`DataGrid`](/database/views/data-grid) is the grid of the table view and the console, for rows without a connection.

## Three layers

| Layer                | Entry point              | Runs in                                 |
| -------------------- | ------------------------ | --------------------------------------- |
| Views and the client | `@adecore/database`      | The page: React 19, in a browser window |
| Host                 | `@adecore/database/host` | The app's backend: Bun or Node          |
| Helper               | `adecore-database`       | A native process the host starts        |

Two entry points import nothing from React or Node, so any layer can use them: `@adecore/database/protocol` holds the message types, and `@adecore/database/testing` the in-memory transport. The platform packages (`@adecore/database-darwin-arm64` and three others) carry the prebuilt helper.

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

## Where to go next

- [Getting started](/database/guide/getting-started) installs the package and wires the three layers.
- [Connections](/database/guide/connections) covers TCP, sockets, SSH, Docker and container discovery.
- [Opening tables as tabs](/database/guide/tabs) answers `onAction` with an app's own tabs.
- [Files](/database/guide/files) covers export, import and the check on paths.
- [Security](/database/guide/security) lists what the host checks and what the app must.
- [Protocol](/database/guide/protocol) lists every method, error code and the helper's wire format.
- The API: [client](/database/api/client), [host](/database/api/host) and [testing](/database/api/testing).
