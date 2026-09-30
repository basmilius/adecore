# Desktop Shell

The main process of an Electron app whose page draws its own interface. The page builds the application menu and draws where updating stands; the shell turns that into a native menu, runs the updater and keeps the page's bridge in the app's own frame.

```sh
bun add @basmilius/desktop-shell
```

Electron and electron-updater are peer dependencies; the app brings its own.

## Two entry points

| Import | For |
|---|---|
| `@basmilius/desktop-shell` | The main process. Imports Electron's types only, so a test runs without Electron. |
| `@basmilius/desktop-shell/bridge` | The shapes that cross IPC. Imports nothing from Electron, so a preload and the page read them as well. |

## Nothing listens on its own

The package registers no IPC handler and listens to no app-wide Electron event; it only follows a window the app hands it. Every IPC message from the page is a security boundary, so the app wires each channel itself, behind its own check of the sender ([`isAppSender`](/desktop-shell/web-guards#isappsender)), and calls into the package from there.

- [Application menu](/desktop-shell/menu): the menu the page builds, the one that stands until it does, and how a command gets back to the page.
- [Updater](/desktop-shell/updater): electron-updater as a state the page watches.
- [Window state](/desktop-shell/window-state): each window opens where it was left.
- [Web guards](/desktop-shell/web-guards): where the app's page may go, and who may speak for it.
