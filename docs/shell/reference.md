# Reference

```ts
import { createAppIpc, createAppScheme, createTheme, createUpdater, createWindows, createWindowState } from '@adecore/shell';
import { ipcSubscriber, type MenuSpec, type ThemeState, type UpdateState } from '@adecore/shell/bridge';
```

## Options

[App scheme](/shell/app-scheme#options) lists the options of `createAppScheme`.

### `UpdaterOptions`

| Option | Type | |
| --- | --- | --- |
| `currentVersion` | `string` | The running version, such as `app.getVersion()`. |
| `packaged` | `boolean` | False in a checkout, which has no feed. |
| `load` | `() => AppUpdater` | Loads electron-updater's `autoUpdater`. Called only when packaged. |
| `publish` | `(state: UpdateState) => void` | Every change of the state. |
| `beforeCheck` | `() => void`, optional | Right before each check. |
| `onQuit` | `(quitting: boolean) => void`, optional | True right before an install quits, false when it failed. Pass `windows.quitForUpdate`. |
| `silentInstall` | `boolean`, optional | Windows only: no installer windows, and the app starts again after. |
| `log` | `(message, error) => void`, optional | Failures. `console.error` by default. |
| `setInterval` | `(run, ms) => unknown`, optional | The hourly timer, for tests. |

The `Updater` it returns has `state()`, `start()`, `configure(autoDownload)`, `check()`, `download()`, `install()` and `setAllowPrerelease(allow)`.

### `WindowsOptions`

| Option | Type | |
| --- | --- | --- |
| `state` | `WindowState` | From `createWindowState`. |
| `session` | `WindowStateStorage` | Which windows were open at the last quit, such as a `fileStorage`. |
| `create` | `(key, bounds, origin, state) => BrowserWindow` | Builds and loads a window. |
| `onFront` | `(window) => void`, optional | A window came to the front. |
| `formerKey` | `string`, optional | The key a single window used to keep its bounds under. |
| `platform` | `NodeJS.Platform`, optional | `process.platform` by default. |
| `setTimeout` | `(run, ms) => unknown`, optional | The timer that asks for a confirmed quit again, for tests. |

The `Windows` it returns has `open`, `restore`, `claim`, `move`, `hold`, `detach`, `transfer`, `holderOf`, `windowAt`, `bringBack`, `setState`, `fromPage`, `fromContents`, `focused`, `keyOf`, `all`, `send`, `attach`, `quit`, `resume` and `quitForUpdate`. [Windows](/shell/windows) and [Quitting](/shell/quitting) explain each.

### `WindowStateOptions`

| Option | Type | |
| --- | --- | --- |
| `storage` | `WindowStateStorage` | Where the bounds live, such as `fileStorage(path)`. |
| `displays` | `() => readonly WindowDisplay[]` | `screen.getAllDisplays`, asked at every open. |
| `defaults` | `WindowSize` | The size of a window with nothing saved. |
| `delayMs` | `number`, optional | How long a window stands still before a write. `500` by default. |
| `setTimeout`, `clearTimeout` | optional | The write timer, for tests. |

The `WindowState` it returns has `bounds(key, fallback?)`, `track(key, window)`, `has(key)`, `displays()`, `fit(bounds)` and `flush()`.

### `ThemeOptions`

| Option | Type | |
| --- | --- | --- |
| `nativeTheme` | `Pick<NativeTheme, 'themeSource'>` | Electron's `nativeTheme`. |
| `windows` | `() => readonly BrowserWindow[]` | The windows to paint. |
| `background` | `string` | A window's background before any page reported one. |
| `overlay` | `TitleBarOverlay`, optional | Off macOS, the height of the controls drawn over the page and their colors per theme. |
| `nativeFrame` | `boolean`, optional | Off macOS, the system's own title bar instead. |
| `trafficLights` | `{ x, y }`, optional | Where macOS puts the traffic lights. `{ x: 17, y: 17 }` by default. |
| `platform` | `NodeJS.Platform`, optional | `process.platform` by default. |

The `Theme` it returns has `apply(state)`, `current()` and `windowOptions()`.

### Menu options

| `MenuTemplateOptions` | |
| --- | --- |
| `run(id, byKey)` | A picked command; `byKey` when its accelerator fired it. |
| `shellItem(action, label)` | What the shell draws for one of its own actions, or `null`. |
| `platform` | Optional, `process.platform` by default. |

| `MenuCommandOptions` | |
| --- | --- |
| `pageKeys` | From `createPageKeys`. |
| `window()` | The window whose page runs a command, a `MenuWindow`. |
| `keyBypassesPage()` | Optional. True while the keyboard is in a page that never passes keys on. |

| `StaticMenuOptions` | |
| --- | --- |
| `appName` | The name of the app menu on macOS. |
| `toggleDevTools()` | Runs from the View menu. |
| `appItems` | Optional. At the top of the app menu on macOS. |
| `quitItems` | Optional. Right above Quit. |
| `fileItems` | Optional. A File menu of their own on macOS, the top of the File menu elsewhere. |
| `platform` | Optional, `process.platform` by default. |

## Exports

Every name each entry point exports, read from its source. Anything not listed is internal and may change in any release.

### `@adecore/shell`

The main process: menu, updater, windows, window state, theme, app scheme and guards.

<ExportTable entry="@adecore/shell" />

### `@adecore/shell/bridge`

The shapes that cross IPC. Imports nothing from Electron, so a preload and the page use it too.

<ExportTable entry="@adecore/shell/bridge" />
