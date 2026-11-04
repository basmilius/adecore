# Bridge

`@adecore/shell/bridge` holds the shapes that cross IPC between the shell and its page. It imports nothing from Electron, so the main process, a preload and the page all import it.

| Name | What it is |
|---|---|
| `MenuSpec`, `MenuNode`, `MENU_ROLES`, `MenuRole`, `MenuBarRole` | The [application menu](/shell/menu) the page builds. |
| `UpdateState`, `UpdateErrorCode` | Where [updating](/shell/updater) stands, and why it [failed](/shell/updater#errors). |
| `ThemeState` | The [theme](/shell/theme) a page reports. |
| `compareVersions`, `isVersion` | One [version order](#versions) for shell and page. |
| `ipcSubscriber`, `Subscribe`, `IpcListeners` | For a preload: turns a channel the main process sends on into a subscribe function for the page. |

## Subscribing in a preload

`ipcSubscriber(ipcRenderer)` returns a function per channel. It takes the page's listener and returns an unsubscribe function. The listener gets the payload, never the event, which carries the sender. `IpcListeners` is the part of `ipcRenderer` it uses (`on` and `removeListener`), and `Subscribe<Args>` is the type of what it returns.

```ts
import { contextBridge, ipcRenderer } from 'electron';
import { ipcSubscriber, type UpdateState } from '@adecore/shell/bridge';

const subscribe = ipcSubscriber(ipcRenderer);

contextBridge.exposeInMainWorld('desktop', {
    onMenuCommand: subscribe<[id: string]>('menu:run'),
    onUpdateState: subscribe<[state: UpdateState]>('update:state')
});
```

The page then subscribes in an effect and returns the unsubscribe function:

```ts
useEffect(() => desktop.onUpdateState((state) => setUpdate(state)), []);
```

The tuple names the arguments the main process sends, so `webContents.send('window:drag', key, x)` becomes `subscribe<[key: string, x: number]>('window:drag')`.

## Versions

`isVersion` accepts `1.2.3` and `1.2.3-beta.1`. It refuses `v1.2.3`, `1.2` and a build suffix, so strip the `v` of a git tag first.

`compareVersions(a, b)` is negative when `a` is older. It follows semver's order: a prerelease sorts before its own release, numeric parts compare by value and below words, and `beta` sorts before `beta.1`. An invalid version sorts below every valid one.

```ts
compareVersions('0.0.10', '0.0.9'); // > 0
compareVersions('0.29.0-beta.4', '0.29.0'); // < 0
releases.sort((a, b) => compareVersions(b.version, a.version)); // newest first
```
