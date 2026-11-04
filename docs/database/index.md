# Database

`@adecore/database` browses, queries and edits SQLite and MySQL or MariaDB databases from a desktop app. React views in the page talk to a host in the app's backend, and the host starts a native helper that holds the drivers. The app carries the requests between page and host over a channel it already has.

<Demo src="database/workbench" fill />

The demos run on [`fakeDatabaseTransport`](/database/api/testing), an in-memory shop. An edited cell stays until the page reloads. The fake runs no SQL beyond `SELECT * FROM <table>`, so the console, filters and the designer's Apply only look real.

## What it does

- [`ConnectionManager`](/database/views/connection-manager) and [`ConnectionForm`](/database/views/connection-manager#connectionform) edit saved connections: SQLite files, and MySQL or MariaDB servers over TCP, a socket, SSH or a Docker container.
- [`DatabaseExplorer`](/database/views/explorer) shows a tree of connections, schemas, tables and columns.
- [`TableView`](/database/views/table-view) shows the rows of a table, with filters, editing, a record view, a value panel, and export and import.
- [`StructureView`](/database/views/structure-view) shows the structure of a table, and [`TableDesigner`](/database/views/table-designer) creates and alters one.
- [`QueryConsole`](/database/views/query-console) runs SQL, with history, paging, transactions and export.
- [`DatabaseWorkbench`](/database/views/workbench) puts the explorer beside tabs for all of these.
- [`DataGrid`](/database/views/data-grid) is the grid of the table view and the console, for rows without a connection.
- The [host](/database/api/host) checks every request, keeps each owner's sessions apart and restarts the helper after a crash.

## What it leaves to the app

The package registers no IPC channel. The app carries requests from the page to the host and checks the sender first. It decides which connections, files and container discovery an owner may use, through `authorize`, `authorizeFile` and `authorizeDiscovery` on the host. Through `DatabaseProvider` it decides where a table opens, which file dialog appears and where settings live.

The package stores nothing. The app keeps the saved connections and splits the password off before it saves one. [Security](/database/guide/security) lists the full split.

## Where to next

- [Getting started](/database/guide/getting-started) installs the package and wires the three layers.
- [How it fits together](/database/guide/architecture) follows a request from the page to the server.
- [Connections](/database/guide/connections) covers TCP, sockets, SSH, Docker and container discovery.
- [Opening tables as tabs](/database/guide/tabs) answers `onAction` with an app's own tabs.
- [Files](/database/guide/files) covers export, import and the check on paths.
- [Security](/database/guide/security) lists what the host checks and what the app must.
- [Protocol](/database/guide/protocol) lists every method, error code and the helper's wire format.
- The views each have a page, starting with [`DatabaseWorkbench`](/database/views/workbench).
- The [client](/database/api/client), [host](/database/api/host) and [testing](/database/api/testing) pages explain each API, and the [reference](/database/reference) lists every export.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/database/LICENSE).
