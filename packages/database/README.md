# @adecore/database

[![npm](https://img.shields.io/npm/v/@adecore/database)](https://www.npmjs.com/package/@adecore/database)
[![Docs](https://img.shields.io/badge/docs-adecore.dev-blue)](https://adecore.dev/database/)

Browse, query and edit SQLite and MySQL or MariaDB databases from a desktop app. React views draw the connections, a table tree, the rows of a table, its structure and a query console. A host in the app's backend and a native helper that talks to the servers do the work behind them.

**[Documentation with a live demo of every view](https://adecore.dev/database/)**

## Install

```sh
bun add @adecore/database
```

`@adecore/ui`, React 19, `react-dom`, `i18next` and `react-i18next` are peer dependencies; the app brings them. Only the page needs them. The host (`@adecore/database/host`) and the protocol (`@adecore/database/protocol`) import none of them.

## Layers

```
page            views, createDatabaseClient(transport)
  |
app channel     ipcMain.handle, a utility process, a WebSocket (the app's own, with its own sender check)
  |
backend         createDatabaseHost, spawnHelper          (Bun or Node)
  |
helper          adecore-database                         (native binary, one JSON message per line)
  |
server          SQLite file, MySQL or MariaDB
```

The package does not carry the messages between the page and the backend. The app does, over a channel it already has and already guards.

## Wire it up

In the backend, create one host per app and hand every request that comes over the channel to it. Check the sender first, and name the owner of the request: a window, a socket. When the owner goes away, release it.

```ts
import { createDatabaseHost, spawnHelper } from '@adecore/database/host';

const host = createDatabaseHost({
    start: () => spawnHelper(helperPath),
    // Optional: turn down connections the page may not open.
    authorize: (connection) => connection.engine !== 'sqlite' || connection.path.startsWith(dataFolder)
});

ipcMain.handle('database:request', (event, request) => {
    if (!isTrustedSender(event)) {
        throw new Error('Untrusted sender.');
    }

    return host.handle(request, String(event.sender.id));
});

app.on('web-contents-created', (_event, contents) => {
    const owner = String(contents.id);
    contents.once('destroyed', () => void host.release(owner));
});
```

On the page, make a client over a transport that sends a request and returns the response, then mount `DatabaseProvider` inside `UIProvider`:

```tsx
import { createDatabaseClient, DatabaseProvider, TableView } from '@adecore/database';

const client = createDatabaseClient((request) => window.database.request(request));

createRoot(root).render(
    <UIProvider i18n={i18next} formatSource={formatSource}>
        <DatabaseProvider client={client}>
            <TableView connection={connection} schema="main" table="customers" className="h-full" />
        </DatabaseProvider>
    </UIProvider>
);
```

A `Connection` is `{ id, name, config }`. The app keeps the list, with the password in its own secure storage; the package stores nothing.

Tell Tailwind to scan the package for its classes, next to the `@source` line of `@adecore/ui`. The path is relative to the CSS file:

```css
@import "tailwindcss";
@import "@adecore/ui/theme.css";

@source "../node_modules/@adecore/ui/dist";
@source "../node_modules/@adecore/database/dist";
```

The words live in the `database` namespace, in English and Dutch. `DatabaseProvider` adds them to the i18next instance of `UIProvider`.

## The helper binary

The helper is a Rust program that holds the database drivers, so a crashing driver cannot take the backend down. Build it with cargo from this folder:

```sh
cargo build --release --locked --manifest-path helper/Cargo.toml
```

The binary is `helper/target/release/adecore-database`. Ship it beside the app's own executable (for Electron, as an entry in `extraResources`) and sign it with the app. Build it once per platform and architecture the app targets. Platform packages on npm that carry a prebuilt binary are not there yet.

## Views and testing

`ConnectionManager` and `ConnectionForm` edit the saved connections. `DatabaseExplorer` lists connections, schemas and tables. `TableView` pages through the rows of a table and edits them. `StructureView` shows columns, indexes, foreign keys and the DDL. `QueryConsole` runs SQL.

`@adecore/database/testing` has `fakeDatabaseTransport`, an in-memory server behind the same transport, for demos and for tests of an app.

## License

MIT
