# @basmilius/desktop-shell

[![npm](https://img.shields.io/npm/v/@basmilius/desktop-shell)](https://www.npmjs.com/package/@basmilius/desktop-shell)
[![Docs](https://img.shields.io/badge/docs-desktop.bas.dev-blue)](https://desktop.bas.dev/desktop-shell/)

The main process of an Electron app whose page draws its own interface. The page builds the application menu and shows where updating stands. The shell turns that menu into a native one and runs electron-updater. It also opens each window where it was left, puts the page's theme on the window and keeps the page's bridge in the app's own frame.

**[Documentation](https://desktop.bas.dev/desktop-shell/)**

## Install

```sh
bun add @basmilius/desktop-shell
```

Electron 44 or later and electron-updater are optional peer dependencies; the app brings its own. The package imports only their types, so a test runs in Bun without Electron.

## Nothing listens on its own

The package registers no IPC handler and listens to no app-wide Electron event. Every IPC message from the page crosses a security boundary, so the app wires each channel itself, behind its own check of the sender (`isAppSender`), and calls into the package from there.

## Entry points

| Import | What it holds |
|---|---|
| `@basmilius/desktop-shell` | For the main process: `createWindows`, `createWindowState`, `createUpdater`, `createTheme`, `menuTemplateOf`, `staticMenuTemplate`, `createMenuCommands`, `createPageKeys` and the web guards |
| `@basmilius/desktop-shell/bridge` | The shapes that cross IPC: `MenuSpec`, `MenuNode`, `MENU_ROLES`, `UpdateState`, `ThemeState` and `compareVersions`. It imports nothing from Electron, so a preload and the page read it too. |

## Documentation

| Page | What it covers |
|---|---|
| [Application menu](https://desktop.bas.dev/desktop-shell/menu) | The menu the page builds, the one that stands until it does, and how a command gets back to the page |
| [Updater](https://desktop.bas.dev/desktop-shell/updater) | electron-updater as a state the page watches |
| [Windows](https://desktop.bas.dev/desktop-shell/windows) | A set of windows, one per key, restored at the next start |
| [Window state](https://desktop.bas.dev/desktop-shell/window-state) | Each window opens where it was left |
| [Theme](https://desktop.bas.dev/desktop-shell/theme) | The page's theme on the window, its controls and Chromium |
| [Web guards](https://desktop.bas.dev/desktop-shell/web-guards) | Where the app's page may go, and who may speak for it |
| [Bridge](https://desktop.bas.dev/desktop-shell/bridge) | The shapes that cross IPC |

## License

MIT
