# Windows

`createWindows` holds the app's windows, each showing what its key names, such as a project, or nothing yet. A key belongs to one window at a time: opening it again raises the window that has it. The windows that were open when the app quit open again at the next start, each where it was left.

```ts
import { createWindows, createWindowState, fileStorage } from '@basmilius/desktop-shell';

const windowState = createWindowState({
    storage: fileStorage(join(app.getPath('userData'), 'window-state.json')),
    displays: () => screen.getAllDisplays(),
    defaults: { width: 1440, height: 900 }
});

const windows = createWindows({
    state: windowState,
    session: fileStorage(join(app.getPath('userData'), 'window-session.json')),
    create: (key, bounds, origin) => {
        const window = new BrowserWindow({ ...bounds, minWidth: 800, minHeight: 500, show: false });
        window.once('ready-to-show', () => window.show());
        void window.loadURL(urlFor(key, origin));
        return window;
    },
    onFront: (window) => drawMenuOf(window)
});

windows.attach(app);
app.whenReady().then(() => windows.restore());
```

`attach` answers what every app with a set of windows does with its app's events: a second instance raises the window in front, a click on the dock icon with no window open opens the last session again, pending bounds are written at quit, and off macOS the app quits with its last window while that window stays in the session.

`create` builds and loads the window; the package passes the bounds to construct it with and follows the window from then on, so `create` never calls `windowState.track` itself. A new window whose key has no bounds of its own sits a little beside the one in front (`CASCADE`).

An app that kept its one window under a key of its own before it had several passes that key as `formerKey`: the first window after the change opens where that window stood.

`origin` says why the window opens: `session` for one that was open at the last quit, `first` for the one window of a start without a session, `opened` for one something asked for. A page can then tell a cold start, which may open what a person had last, from a new window, which starts empty. `onFront` runs once a window came to the front, when `focused()` already answers it.

## What a window shows

A window can come to show something else, as when its page opens a project from a start screen. The page says so, and the shell answers whether it may:

```ts
handleFromApp('window:claim', (event, key: unknown) => {
    const window = windows.fromPage(event.sender);
    return window !== null && (key === null || typeof key === 'string') && windows.claim(window, key);
});
```

`claim` is false when another window already shows the key; that window comes to the front instead, and the page stays where it was. `null` lets a key go. From a claim on, the window's bounds are kept under its new key.

`open(key)` is for the shell's own reasons to open a window, such as a menu item or a page asking for a project in a new window. `open(null)` always opens a new one.

`move(window)` puts what a window shows into a new window and leaves the old one without a key, with no moment in between where nobody has it. The old page then shows its empty state.

## Who asked

Every IPC handler resolves its window from the sender instead of assuming one: `fromPage(event.sender)` answers only for the page of an app window, so it is also the check of who may speak for the app. `fromContents` also knows the window of a `<webview>` inside a page, which Electron gives no window of its own, so a guest's context menu opens over the right window; it never decides who may call a handler. What has no sender, such as a second instance, a notification or a menu command, goes to `focused()`, the window last in front. `send(channel, ...args)` reaches every window, for what the whole app shares.

## Quitting

A window that closes leaves the session, so closing one of three windows opens two next time. Call `quit()` once a quit goes ahead: from then on the windows that close stay in the session, and the next start opens all of them.

```ts
app.on('before-quit', () => windows.quit());
```

Off macOS, where the app quits with its last window, `attach` marks the quit as that window closes, so it stays in the session.

An app that asks before quitting calls it only on the path where the quit proceeds. When a quit still does not happen, `resume()` lets closing windows leave the session again. An update install closes the windows before `before-quit`; the [updater](/desktop-shell/updater#installing)'s `onQuit` covers that.
