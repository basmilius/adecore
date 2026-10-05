# @adecore/database

Browse, query and edit SQLite and MySQL or MariaDB databases from a desktop app. The package has React views for the page, a host for the app's backend and a native helper that talks to the servers.

```tsx
import { DatabaseWorkbench } from '@adecore/database';
```

<Demo src="database/workbench" fill />

The demos on these pages run over [`fakeDatabaseTransport`](/database/api/testing), an in-memory shop with customers, products and orders. Open a table in the workbench above, edit a cell, submit it, and the change stays until the page reloads. The fake runs no SQL beyond `SELECT * FROM <table>`, so a console, a filter or the designer's Apply show what a real server would do only in how they look.

## What is in it

- Connections: [`ConnectionManager`](/database/views/connection-manager) and its form edit SQLite files and MySQL or MariaDB servers, reached over TCP, a socket, SSH or a Docker container. See [Connections](/database/guide/connections).
- Browsing: [`DatabaseExplorer`](/database/views/explorer) is a tree of connections, schemas, tables and columns, and [`TableView`](/database/views/table-view) shows the rows of a table with a filter and sort field, editing, a record view, a value panel and export and import.
- Structure: [`StructureView`](/database/views/structure-view) reads a table, and [`TableDesigner`](/database/views/table-designer) creates and alters one, showing the SQL first.
- Querying: [`QueryConsole`](/database/views/query-console) runs the selection or the statement under the caret, with history, paging, transactions and export.
- Together: [`DatabaseWorkbench`](/database/views/workbench) puts the explorer beside tabs for all of those. An app with tabs of its own answers the [actions](/database/guide/tabs) of the views instead.

## Three layers

| Layer                | Entry point              | Runs in                                 |
| -------------------- | ------------------------ | --------------------------------------- |
| Views and the client | `@adecore/database`      | The page: React 19, in a browser window |
| Host                 | `@adecore/database/host` | The app's backend: Bun or Node          |
| Helper               | `adecore-database`       | A native process the host starts        |

Two more entry points are readable everywhere. `@adecore/database/protocol` holds the types of every message, and `@adecore/database/testing` holds the in-memory transport. The platform packages (`@adecore/database-darwin-arm64` and the four others) carry the prebuilt helper and no code; the package manager installs the one that fits the machine.

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

The views never talk to a server. They call a [`DatabaseSession`](/database/api/client) that a `DatabaseClient` makes for a saved connection, and the client sends [protocol](/database/guide/protocol) requests through a `DatabaseTransport`. The transport is one function: it takes a request and resolves with the response. The app writes it over whatever it already has, such as Electron IPC or a WebSocket.

On the other side of that channel the app hands each request to the [host](/database/api/host). The host checks the shape of the request, keeps track of which owner opened which session, asks the app about connections, files and discovery, and passes the request to the helper on its stdin. The package registers no channel and listens to no event of its own, because the app has to check who is asking before anything reaches a database. See [Security](/database/guide/security).

The views ask the app for things that are the app's to place: where a table opens, where a file is chosen, where a setting is kept. `DatabaseProvider` takes `onAction`, `files` and `storage` for those. See [Getting started](/database/guide/getting-started#databaseprovider).

## Why a separate helper

The database drivers live in a Rust binary, not in the backend. That has three consequences:

- A driver that crashes takes the helper down and nothing else. The host answers the requests that were running with `helper-exited` and starts a new helper on the next request.
- It is the same binary under Bun, under Node and inside Electron's utility process. There is no native module to rebuild per runtime or per Electron version.
- The helper pages the rows and cuts long cells down to a preview, so the backend never holds a whole table.

The binary comes prebuilt, one npm package per platform, and `helperPath()` finds it. See [Getting started](/database/guide/getting-started#the-helper).

## What crosses the wire

Every message is JSON, so any channel can carry it. Three rules keep the data honest:

- A value that cannot be a JavaScript number arrives as text. An integer beyond `Number.MAX_SAFE_INTEGER`, a decimal, a date and a time are the text the server writes for them, so nothing is rounded on the way. The `kind` of the column says how to read it.
- A long cell arrives as a preview. Text past the cell limit becomes `{ kind: 'longText', preview, length }` and bytes become `{ kind: 'binary', hex, length }`. A view asks for the whole value with the `cell` method when a person opens or edits it.
- Rows come in pages. A `rows` request has an `offset` and a `limit` of at most 10000, and the answer says whether another row exists past the page. Counting all rows is a separate request, since on a big table it is slow. A query result pages the same way through `page`, and an export streams every row to a file without passing it through the page.

## Where to go next

- [Getting started](/database/guide/getting-started) installs the package and wires the three layers.
- [Connections](/database/guide/connections) covers TCP, socket, SSH and Docker, and discovering containers.
- [Opening tables as tabs](/database/guide/tabs) wires `onAction` to an app's own tabs.
- [Files](/database/guide/files) covers export, import and the checks on paths.
- [Security](/database/guide/security) explains what the host checks and what the app must.
- [Protocol](/database/guide/protocol) lists every method, error code and the helper's wire format.
- The views: [`ConnectionManager`](/database/views/connection-manager), [`DatabaseExplorer`](/database/views/explorer), [`TableView`](/database/views/table-view), [`StructureView`](/database/views/structure-view), [`TableDesigner`](/database/views/table-designer), [`QueryConsole`](/database/views/query-console) and [`DatabaseWorkbench`](/database/views/workbench).
- The API: [client](/database/api/client), [host](/database/api/host) and [testing](/database/api/testing).
