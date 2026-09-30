# @basmilius/desktop-shell

The main process of an Electron app whose page draws its own interface: the application menu the page builds, an updater the page watches, windows that open where they were left, and the guards that keep the page's bridge in the app's own frame.

The documentation is at [desktop.bas.dev/desktop-shell](https://desktop.bas.dev/desktop-shell/).

```sh
bun add @basmilius/desktop-shell
```

Electron and electron-updater are peer dependencies; the app brings its own.

## Entry points

| Import | What it holds |
|---|---|
| `@basmilius/desktop-shell` | For the main process: `menuTemplateOf`, `staticMenuTemplate`, `createMenuCommands`, `createPageKeys`, `createUpdater`, `createWindowState` and the web guards |
| `@basmilius/desktop-shell/bridge` | The shapes that cross IPC, for the main process, a preload and the page alike: `MenuNode`, `MenuSpec`, `MENU_ROLES`, `UpdateState`, `compareVersions` |

Nothing here registers an IPC handler. The app wires each channel itself, behind its own check of the sender, and calls into the package.

## License

MIT
