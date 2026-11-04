# Quitting

A [set of windows](/shell/windows) keeps a session: the windows open at quit reopen at the next start. This page covers which windows stay in it, a quit the app confirms first and a quit an update starts.

## Which windows stay

A window that closes leaves the session, so closing one of three windows opens two next time. A window closed by a quit stays in it. Off macOS the last window, which quits the app, stays in the session too.

## Asking first

An app that asks before quitting, or must finish something first, passes `confirmQuit` to `attach`. It runs once per quit, before any window closes, and the quit waits for it. `true` lets the quit go ahead and `false` cancels it. A throw lets the quit go ahead, so a broken check never traps the app. On `false`, a window that already closed for the quit (the last one off macOS) reopens.

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

The argument is a `QuitRequest`. Its `update` is true for a quit an update install started. `AttachOptions` holds `confirmQuit`. `setTimeout` in the `WindowsOptions` replaces the timer that asks for the quit again once `confirmQuit` said yes, for tests.

## Deciding in your own listener

Without `confirmQuit`, an app that decides in its own `before-quit` listener calls `windows.quit()` once the quit goes ahead and `windows.resume()` when it is cancelled. A listener that only calls `event.preventDefault()`, for example to hide the app, needs neither.

## An update install

electron-updater closes the windows before the app's `before-quit` runs. Pass `windows.quitForUpdate` as the updater's `onQuit`, so the windows the install closes stay in the session and reopen if the install fails:

```ts
const updater = createUpdater({
    // ...
    onQuit: windows.quitForUpdate
});
```

[Updater](/shell/updater#installing) covers the install itself.
