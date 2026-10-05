# Database example

An Electron app that runs both sides of `@adecore/database`: the views in the page, and the host with the Rust helper in the main process. It is private and never published.

It opens with a demo shop (SQLite, created in the app's user data folder on first start). The sidebar browses connections, schemas and tables. A table opens in a tab with its data and its structure, a console runs SQL, and the connection manager shows up both in a dialog and in a tab.

## Run

```sh
bun install
bun run --cwd examples/database start
```

`start` builds the helper with `cargo` (Rust is required), builds the app, fetches the Electron binary when it is missing (Bun skips the install script of a dependency) and launches Electron. Run `bun run build` alone to rebuild after a change; the packages are read from their source, so they need no build.

## Helper

The app looks for `packages/database/helper/target/release/adecore-database`. Set `ADECORE_DATABASE_HELPER` to the path of another binary to use that instead.

## MySQL and MariaDB

Open "Manage connections" (the button in the sidebar header, or the Connections tab), add a MySQL connection and fill in the host, user and password. "Test connection" checks what you filled in.
