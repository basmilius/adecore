# @adecore/shell

The main process of an Electron app whose page draws its own interface. The page builds the application menu and draws where updating stands; the shell turns that into a native menu, runs the updater and keeps the page's bridge in the app's own frame.

```sh
bun add @adecore/shell
```

Electron and electron-updater are peer dependencies; the app brings its own.

## Two entry points

| Import | For |
|---|---|
| `@adecore/shell` | The main process. Imports Electron's types only, so a test runs without Electron. |
| `@adecore/shell/bridge` | The shapes that cross IPC. Imports nothing from Electron, so a preload and the page read them as well. |

## Nothing listens on its own

The package registers no IPC handler and listens to no app-wide Electron event by itself; it only follows the windows, and with [`attach`](/shell/windows), the app that the app hands it. Every IPC message from the page is a security boundary, so the app wires each channel itself, behind its own check of the sender ([`isAppSender`](/shell/web-guards#isappsender)), and calls into the package from there.

- [Application menu](/shell/menu): the menu the page builds, the one that stands until it does, and how a command gets back to the page.
- [Updater](/shell/updater): electron-updater as a state the page watches.
- [Windows](/shell/windows): a set of windows, one per key, restored at the next start.
- [Window state](/shell/window-state): each window opens where it was left.
- [Theme](/shell/theme): the page's theme on the window, its controls and Chromium.
- [Web guards](/shell/web-guards): where the app's page may go, and who may speak for it.
- [App scheme](/shell/app-scheme): the app's page served from a scheme of its own, with the guards bound to it.
- [Bridge](/shell/bridge): the shapes a preload and the page share with the main process.
