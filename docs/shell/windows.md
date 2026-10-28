# Windows

`createWindows` holds the app's windows. Each shows what its key names, such as a project, or nothing yet. A key belongs to one window at a time, so opening it again raises that window. The windows open at quit reopen at the next start, each where it was left.

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

`attach` handles the app events:

- A second instance raises the window in front.
- A dock click with no window open restores the last session.
- A quit keeps its windows in the session and writes pending bounds.
- Off macOS the app quits with its last window, which stays in the session.

[Quitting](#quitting) covers an app that asks first.

`create` builds and loads the window with the bounds it gets. The package tracks the window from then on, so `create` never calls `windowState.track`. A key without saved bounds opens a little beside the window in front.

An app that used to keep its single window under its own key passes that key as `formerKey`, so the first window opens where the old one stood. A window without a key keeps its bounds under `'start'`.

`origin`, a `WindowOrigin`, says why the window opens: `session` (open at the last quit), `first` (the one window of a start without a session) or `opened` (asked for). It lets a page tell a cold start from a new, empty window. `onFront` runs once a window is in front and `focused()` returns it.

## What a window shows

A window can switch to another key, as when its page opens a project from a start screen. The page asks, and the shell answers whether it may:

```ts
// The app's own handler; `fromPage` is its check of the sender.
handleFromApp('window:claim', (event, key: unknown) => {
    const window = windows.fromPage(event.sender);
    return window !== null && (key === null || typeof key === 'string') && windows.claim(window, key);
});
```

`claim` returns false when another window already shows the key. That window comes to the front and the page stays where it was. `null` releases the key. After a claim, the window's bounds are kept under its new key.

`open(key)` opens a window for the shell's own reasons, such as a menu item. `open(null)` always opens a new one.

`move(window)` moves what a window shows into a new window and leaves the old one without a key. The old page then shows its empty state.

Both take an optional `WindowPoint`, `{ x, y }` on screen, for the new window's top left corner, such as under the pointer of a drag. A window that is raised instead stays put.

## Keys a window keeps

A window can keep keys besides the one it shows, such as the projects of its tabs. `hold(window, keys)` sets them and returns the keys the window now has. A key another window shows or keeps stays with that window. `claim` and `open` for a kept key raise its window, and `holderOf(key)` returns that window, so the app can tell its page to show the key.

`detach(window, key, at)` moves a shown or kept key into a new window, as when a tab is dragged out. `transfer(key, window)` hands a key to another window, as when the tab is dropped there. Its page then shows the key with `claim`. `windowAt(point, except)` returns the window under a screen point, most recently in front first.

## What a page keeps

`setState(window, state)` keeps a string for the window across a quit, such as its open tabs. The shell never reads it. At the next start, `create` gets it back as its fourth argument, `state`. A window opened any other way gets `null`. Put it in the window's URL so a reload finds it too.

## Who asked

Every IPC handler resolves its window from the sender. `fromPage(event.sender)` answers only for the page of an app window, so it doubles as the check of who may speak for the app. `fromContents` also resolves a `<webview>` inside a page, for example to open a guest's context menu over the right window. Never use it to authorize a handler. Events without a sender, such as a second instance or a menu command, go to `focused()`, the window last in front. `send(channel, ...args)` reaches every window. `keyOf(window)` returns the key a window shows, and `all()` lists the open windows.

`WindowsOptions` and `Windows` are exported types.

## Quitting

A window that closes leaves the session, so closing one of three windows opens two next time. A window closed by a quit stays in it. Off macOS the last window, which quits the app, stays in the session too.

An app that asks before quitting, or must finish something first, passes `confirmQuit`. It runs once per quit, before any window closes, and the quit waits for it. `true` lets the quit go ahead and `false` cancels it. A throw lets the quit go ahead, so a broken check never traps the app. On `false`, a window that already closed for the quit (the last one off macOS) reopens.

```ts
windows.attach(app, {
    confirmQuit: async ({ update }) => {
        if (!update && (await workIsRunning()) && !(await askToStopWork())) {
            return false;
        }
        await server.close();
        return true;
    }
});
```

`update` is true for a quit an [update install](/shell/updater#installing) started. `AttachOptions` and `QuitRequest` are exported types. `setTimeout` in the options replaces the timer that retries the quit, for tests.

Without `confirmQuit`, an app that decides in its own `before-quit` listener calls `quit()` once the quit goes ahead and `resume()` when it is cancelled. A listener that only calls `event.preventDefault()`, for example to hide the app, needs neither.
