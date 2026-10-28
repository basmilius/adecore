# @adecore/shell

The main process of an Electron app whose page draws its own interface. The page builds the menu and draws the update state. The shell turns that into a native menu, runs the updater and keeps the bridge in the app's own frame.

```sh
bun add @adecore/shell
```

Electron and electron-updater are peer dependencies; the app brings its own.

## Two entry points

| Import | For |
|---|---|
| `@adecore/shell` | The main process. Imports Electron's types only, so tests run without Electron. |
| `@adecore/shell/bridge` | The shapes that cross IPC. Imports nothing from Electron, so a preload and the page can use it. |

## Nothing listens on its own

The package registers no IPC handler and listens to no app-wide Electron event. It follows only the windows and, with [`attach`](/shell/windows), the app you hand it. The app wires each channel itself, behind its own sender check ([`isAppSender`](/shell/web-guards#isappsender)), and calls into the package from there.

- [Application menu](/shell/menu): the menu the page builds and the one that stands until it does.
- [Updater](/shell/updater): electron-updater as a state the page watches.
- [Windows](/shell/windows): one window per key, restored at the next start.
- [Window state](/shell/window-state): each window opens where it was left.
- [Theme](/shell/theme): the page's theme on the window, its controls and Chromium.
- [Web guards](/shell/web-guards): where the page may go and who may speak for it.
- [App scheme](/shell/app-scheme): the page served from a scheme of its own.
- [Bridge](/shell/bridge): the shapes a preload and the page share with the main process.
