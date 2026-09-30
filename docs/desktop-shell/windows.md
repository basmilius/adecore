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
    create: (key, bounds) => {
        const window = new BrowserWindow({ ...bounds, minWidth: 800, minHeight: 500, show: false });
        window.once('ready-to-show', () => window.show());
        void window.loadURL(urlFor(key));
        return window;
    }
});

app.whenReady().then(() => windows.restore());
```

`create` builds and loads the window; the package passes the bounds to construct it with and follows the window from then on. A new window whose key has no bounds of its own sits a little beside the one in front (`CASCADE`).

## What a window shows

A window can come to show something else, as when its page opens a project from a start screen. The page says so, and the shell answers whether it may:

```ts
handleFromApp('window:claim', (event, key: unknown) => {
    const window = windows.fromContents(event.sender);
    return window !== null && (key === null || typeof key === 'string') && windows.claim(window, key);
});
```

`claim` is false when another window already shows the key; that window comes to the front instead, and the page stays where it was. `null` lets a key go. From a claim on, the window's bounds are kept under its new key.

`open(key)` is for the shell's own reasons to open a window, such as a menu item or a page asking for a project in a new window. `open(null)` always opens a new one.

## Who asked

Every IPC handler resolves its window from the sender instead of assuming one: `fromContents(event.sender)`. It also knows the window of a `<webview>` inside a page, which Electron gives no window of its own, so a guest's context menu opens over the right window. What has no sender, such as a second instance, a notification or a menu command, goes to `focused()`, the window last in front. `send(channel, ...args)` reaches every window, for what the whole app shares.

## Quitting

A window that closes leaves the session, so closing one of three windows opens two next time. Call `quit()` once a quit goes ahead: from then on the windows that close stay in the session, and the next start opens all of them.

```ts
app.on('before-quit', () => windows.quit());
```

An app that asks before quitting calls it only on the path where the quit proceeds.
