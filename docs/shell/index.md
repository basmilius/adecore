# Shell

`@adecore/shell` is the main process of an Electron app whose page draws its own interface. The page builds the menu, draws the update state and reports its theme. The shell turns that into a native menu, runs electron-updater, keeps the windows and their places, and decides which page may speak for the app.

## What it does

- Draws the menu the page sends, and a fixed menu until it does.
- Runs electron-updater as a state the page watches, with no dialog.
- Opens one window per key, such as a project, and reopens the windows of the last session where they were left.
- Paints each window in the page's theme, with native window controls off macOS.
- Serves the built page from a scheme of its own, such as `app://app`, with a real origin.
- Decides where the page may navigate, which links may leave for the system browser and which IPC sender is the app.
- Shares the shapes that cross IPC with the preload and the page through `@adecore/shell/bridge`.

## What it leaves to the app

The package registers no IPC handler and listens to no app-wide Electron event. It follows only the windows it opens and, with [`attach`](/shell/windows#app-events), the app you hand it. The app names its channels, wires each one behind its own [sender check](/shell/ipc) and calls into the package from there. The preload, the content security policy, what a window loads and every label in the menu stay in the app too.

Electron and electron-updater are optional peers, imported as types only. Every decision is a pure function or a factory with its clock and timer passed in, so tests run in Bun without Electron.

## Where to next

- [Getting started](/shell/getting-started) wires a main process and a preload end to end.
- [Application menu](/shell/menu) covers the menu the page builds and the one that stands until it does.
- [Updater](/shell/updater) covers electron-updater as a state the page watches.
- [Windows](/shell/windows) and [Quitting](/shell/quitting) cover one window per key, the session and a quit the app confirms.
- [Window state](/shell/window-state) covers where a single window opens.
- [Theme](/shell/theme) covers the page's theme on the window, its controls and Chromium.
- [App scheme](/shell/app-scheme) covers the page served from a scheme of its own.
- [Navigation and links](/shell/navigation) and [IPC and senders](/shell/ipc) cover where the page may go and who may speak for it.
- [Bridge](/shell/bridge) covers the shapes a preload and the page share with the main process.
- [Reference](/shell/reference) lists the options of every factory and every export.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/shell/LICENSE).
