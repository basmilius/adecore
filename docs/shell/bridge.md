# Bridge

`@adecore/shell/bridge` holds the shapes that cross IPC between the shell and its page. It imports nothing from Electron, so a preload and the page import it as well as the main process. A preload hands every answer to the page as `unknown`; one shape in one place keeps both ends from drifting apart without the compiler saying so.

| Name | What it is |
|---|---|
| `MenuSpec`, `MenuNode`, `MENU_ROLES`, `MenuRole`, `MenuBarRole` | The [application menu](/shell/menu) the page builds. |
| `UpdateState`, `UpdateErrorCode` | Where [updating](/shell/updater) stands, and why it [failed](/shell/updater#errors). |
| `ThemeState` | The [theme](/shell/theme) a page reports. |
| `compareVersions`, `isVersion` | One ordering of versions for the shell and the page, so release notes land under the right heading. `isVersion` accepts a plain `1.2.3` only, so strip the `v` of a git tag first. A version that is not one sorts below every one that is. |
| `ipcSubscriber`, `Subscribe`, `IpcListeners` | For a preload: a channel the main process sends on, as what the page subscribes with. |

## Subscribing in a preload

`ipcSubscriber(ipcRenderer)` gives a function per channel that takes the page's listener and returns what removes it again. The listener gets what the main process sent and never the event, which carries the sender. `IpcListeners` is the part of `ipcRenderer` it uses, so the bridge still imports nothing from Electron.

```ts
const subscribe = ipcSubscriber(ipcRenderer);

contextBridge.exposeInMainWorld('desktop', {
    onMenuCommand: subscribe<[id: string]>('menu:run'),
    onUpdateState: subscribe<[state: UpdateState]>('update:state')
});
```
