# Bridge

`@adecore/shell/bridge` holds the shapes that cross IPC between the shell and its page. It imports nothing from Electron, so the main process, a preload and the page all import it. One shape in one place keeps both ends in step.

| Name | What it is |
|---|---|
| `MenuSpec`, `MenuNode`, `MENU_ROLES`, `MenuRole`, `MenuBarRole` | The [application menu](/shell/menu) the page builds. |
| `UpdateState`, `UpdateErrorCode` | Where [updating](/shell/updater) stands, and why it [failed](/shell/updater#errors). |
| `ThemeState` | The [theme](/shell/theme) a page reports. |
| `compareVersions`, `isVersion` | One version ordering for shell and page. `isVersion` accepts a plain `1.2.3` only, so strip the `v` of a git tag first. An invalid version sorts below every valid one. |
| `ipcSubscriber`, `Subscribe`, `IpcListeners` | For a preload: turns a channel the main process sends on into a subscribe function for the page. |

## Subscribing in a preload

`ipcSubscriber(ipcRenderer)` returns a function per channel. It takes the page's listener and returns an unsubscribe function. The listener gets the payload, never the event, which carries the sender. `IpcListeners` is the part of `ipcRenderer` it uses.

```ts
const subscribe = ipcSubscriber(ipcRenderer);

contextBridge.exposeInMainWorld('desktop', {
    onMenuCommand: subscribe<[id: string]>('menu:run'),
    onUpdateState: subscribe<[state: UpdateState]>('update:state')
});
```
