# Windows

`createWindows` holds the app's windows. Each shows what its key names, such as a project, or nothing yet (`null`). A key belongs to one window at a time, so opening it again raises that window. The windows open at quit reopen at the next start, each where it was left.

```ts
import { createWindows, createWindowState, fileStorage } from '@adecore/shell';

const windowState = createWindowState({
    storage: fileStorage(join(app.getPath('userData'), 'window-state.json')),
    displays: () => screen.getAllDisplays(),
    defaults: { width: 1440, height: 900 }
});

const windows = createWindows({
    state: windowState,
    session: fileStorage(join(app.getPath('userData'), 'window-session.json')),
    create: (key, bounds, origin, state) => {
        const window = new BrowserWindow({ ...bounds, minWidth: 800, minHeight: 500, show: false });
        window.once('ready-to-show', () => window.show());
        void window.loadURL(urlFor(key, origin, state));

        return window;
    },
    onFront: (window) => drawMenuOf(window)
});

windows.attach(app);
app.whenReady().then(() => windows.restore());
```

## Creating a window

`create` builds and loads the window with the bounds it gets. The package tracks the window with the [window state](/shell/window-state) from then on, so `create` never calls `windowState.track`. A key without saved bounds opens a little beside the window in front. A window without a key keeps its bounds under `'start'`.

`origin`, a `WindowOrigin`, says why the window opens: `session` (open at the last quit), `first` (the one window of a start without a session) or `opened` (asked for). It lets a page tell a cold start from a new, empty window. The fourth argument is the [state the page kept](#what-a-page-keeps).

An app that used to keep its single window under its own key passes that key as `formerKey`, so the first window opens where the old one stood.

`restore()` opens the windows of the last session, or one window without a key when there is none. `onFront` runs once a window is in front, and `focused()` returns it.

## App events

`attach(app)` follows the app's events. Call it before `app.whenReady()`, and `restore()` once ready.

- A second instance raises the window in front, or restores the session when no window is open.
- A dock click with no window open restores the last session.
- A dock click while windows are open but none shows brings them back with `bringBack()`.
- A quit keeps its windows in the session and writes pending bounds.
- Off macOS the app quits with its last window, which stays in the session.

[Quitting](/shell/quitting) covers an app that asks before it quits.

## Windows that got lost

A window can end up where nobody reaches it. When an external display sleeps on a lock, macOS removes the Space of a window that was in full screen on it, and the window is left on no display at all. `bringBack()` puts every window back. A hidden window or one off every display moves onto a display and shows. A window in full screen whose display is gone leaves full screen first. A minimized window stays in the dock.

The package listens to no event of the system, so the app calls `bringBack()` once things settle:

```ts
const settle = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => windows.bringBack(), 1000);
};

screen.on('display-removed', settle);
screen.on('display-added', settle);
powerMonitor.on('unlock-screen', settle);
powerMonitor.on('resume', settle);
```

A full screen window counts as lost only against the displays' `bounds`, which `screen.getAllDisplays()` includes.

## What a window shows

A window can switch to another key, as when its page opens a project from a start screen. The page asks, and the shell answers whether it may:

```ts
// The app's own handler, behind its check of the sender.
ipc.handle('window:claim', (event, key: unknown) => {
    const window = windows.fromPage(event.sender);

    return window !== null && (key === null || typeof key === 'string') && windows.claim(window, key);
});
```

`claim` returns false when another window already shows or keeps the key. That window comes to the front and the page stays where it was. `null` releases the key. After a claim, the shell keeps the window's bounds under its new key.

`open(key)` opens a window for the shell's own reasons, such as a menu item. `open(null)` always opens a new one.

`move(window)` moves what a window shows into a new window and leaves the old one without a key. The old page then shows its empty state. It returns `null` for a window that shows nothing.

Both take an optional `WindowPoint`, `{ x, y }` on screen, for the new window's top left corner, such as under the pointer of a drag. A window that is raised instead stays put.

## Keys a window keeps

A window can keep keys besides the one it shows, such as the projects of its tabs. `hold(window, keys)` sets them and returns the keys the window now has. A key another window shows or keeps stays with that window. `claim` and `open` for a kept key raise its window, and `holderOf(key)` returns that window, so the app can tell its page to show the key.

`detach(window, key, at)` moves a shown or kept key into a new window, as when a tab is dragged out. `transfer(key, window)` hands a key to another window, as when the tab is dropped there. Its page then shows the key with `claim`. `windowAt(point, except)` returns the visible window under a screen point, most recently in front first.

```ts
// A tab was dropped at a point on the screen.
const target = windows.windowAt(point, source);

if (target === null) {
    windows.detach(source, key, point);
} else {
    windows.transfer(key, target);
    target.webContents.send('tab:show', key);
}
```

## What a page keeps

`setState(window, state)` keeps a string for the window across a quit, such as its open tabs. The shell never reads it. At the next start, `create` gets it back as its fourth argument. A window opened any other way gets `null`. Put it in the window's URL so a reload finds it too.

## Reaching the windows

Every IPC handler resolves its window from the sender with `fromPage`, which [IPC and senders](/shell/ipc#which-window-sent-it) explains along with `fromContents`. `send(channel, ...args)` reaches the page of every window, for what the whole app shares, such as where updating stands. `keyOf(window)` returns the key a window shows, and `all()` lists the open windows.

`createWindows` takes `WindowsOptions` and returns `Windows`. The [reference](/shell/reference#windowsoptions) lists the options.
