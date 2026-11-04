# IPC and senders

Every channel the page reaches can do what the app can, so each one must know who sent the message. The package registers no channel itself. The app wires each one behind its own check, and these helpers make that check hard to forget.

## isAppSender

Whether an IPC message came from the top frame of an app window that is still on the app's origin. The web contents alone proves nothing, since it stays the same object whatever it navigates to. Check it first in every handler. `SenderFrame` is the part of `event.senderFrame` it reads: `url` and `parent`.

```ts
const fromApp = (event: Electron.IpcMainInvokeEvent): boolean => isAppSender(windows.fromPage(event.sender) !== null, event.senderFrame, appOrigin);
```

With an [app scheme](/shell/app-scheme), `scheme.isAppSender(isAppWindow, frame)` binds the origin and the scheme.

## createAppIpc

Puts that check in front of every channel, so a new channel cannot skip it. Hand it `ipcMain`, the app's check and how to find the window of a page. The `AppIpc` it returns has `handle` and `on`, which register a channel only when the app calls them. A request from any other page rejects with "Only the app window may ask this", and a message from one is dropped. `senderWindow(event)` names the window whose page sent it, for a dialog that belongs there.

```ts
const ipc = createAppIpc(ipcMain, fromApp, (contents) => windows.fromPage(contents));

ipc.handle('file:read', (_event, path: string) => readFile(path, 'utf8'));

ipc.handle('file:pick', (event) => {
    const window = ipc.senderWindow(event);

    return window === null ? null : dialog.showOpenDialog(window, { properties: ['openFile'] });
});
```

## Which window sent it

A [set of windows](/shell/windows) resolves the window behind a sender in two ways:

- `windows.fromPage(contents)` answers only for the page of an app window, so it doubles as the "is this an app window" half of the check.
- `windows.fromContents(contents)` also resolves a `<webview>` inside a page, for example to open a guest's context menu over the right window. Never use it to authorize a handler.

Events without a sender, such as a second instance or a menu command, go to `windows.focused()`, the window last in front.

## Validate what arrives

The check says who sent a message, not that its payload is sound. Treat every argument as `unknown` until the handler has checked it, as the `window:claim` handler in [Windows](/shell/windows#what-a-window-shows) does. `updater.configure` takes `unknown` for the same reason and only turns downloading on for `true`.
