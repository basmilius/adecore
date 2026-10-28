# Window state

`createWindowState` keeps each window's size, position and maximized or full screen state, so it reopens the same way. The app picks the key, such as `main` or the project a window shows.

```ts
import { createWindowState, fileStorage } from '@adecore/shell';

const windowState = createWindowState({
    storage: fileStorage(join(app.getPath('userData'), 'window-state.json')),
    displays: () => screen.getAllDisplays(),
    defaults: { width: 1440, height: 900 }
});

const createWindow = (): BrowserWindow => {
    const window = new BrowserWindow({ ...windowState.bounds('main'), minWidth: 800, minHeight: 500, show: false });
    windowState.track('main', window);
    window.once('ready-to-show', () => window.show());
    return window;
};

app.on('before-quit', () => windowState.flush());
```

`bounds` goes into the constructor. `track` follows the window from then on. Call it right after constructing the window, before it is shown, because it restores maximized or full screen once the window is ready to show.

`bounds` takes a fallback as its second argument, such as a spot beside another window, for a key with nothing saved. `has` says whether a key has saved bounds. A window whose key changes passes `track` a function that returns the current key. [`createWindows`](/shell/windows) does all of this for a set of windows.

## When it writes

Half a second (`delayMs`) after a window stops moving or resizing, at once when it closes, and on `flush` at quit. `setTimeout` and `clearTimeout` replace the timer in a test. It saves the normal bounds, so a maximized window comes back maximized and unmaximizes to its own size.

## Displays that changed

Saved bounds are kept only while a display still shows enough of the window to grab its title bar. The window then moves fully onto that display and shrinks to its work area. Otherwise it opens at its default size, centered.

## Storage

`fileStorage` writes one JSON file atomically. An unreadable file, or one from another version, counts as a first start. Any `WindowStateStorage`, an object with `read()` and `write(text)`, can replace the file.

`WindowStateOptions`, `WindowState`, `SavedWindow`, `StateWindow` (the part of a `BrowserWindow` it uses), `WindowDisplay` and `WindowSize` are exported types.
