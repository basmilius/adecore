# Database example

An Electron app that runs both sides of `@adecore/database`: the views in the page, and the host with the Rust helper in the main process. It is private and never published.

It opens with a demo shop (SQLite, created in the app's user data folder on first start). A switch in the title bar picks one of two layouts. "Workbench" is the `DatabaseWorkbench` as it comes: the explorer, and closable tabs for tables (data and structure), consoles and the table designer. "Side pane" places the same views the way an app with tabs of its own would: the explorer in a side pane, and the app's tabs wired through the `onAction` of `DatabaseProvider`, with the connection manager in a dialog and in a tab.

The title bar also has a number format: a region picker that feeds the `formatSource` of `UIProvider`, and a switch between "Database notation" and "Regional" for the `numberNotation` of `DatabaseProvider`. Both are remembered for the next start.

Export and import use the system file dialogs. The main process remembers the paths the dialogs returned in this run, and the host refuses every other file.

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
