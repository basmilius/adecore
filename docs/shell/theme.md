# Theme

The page owns its theme and reports it to the shell as a `ThemeState` (`@adecore/shell/bridge`). `createTheme` paints what only the shell can. It sets each window's background, so a reload or resize never flashes the other theme. It colors the native window controls off macOS. It sets the `prefers-color-scheme` Chromium reports, so a page follows the app instead of the system.

```ts
import { createTheme } from '@adecore/shell';

const theme = createTheme({
    nativeTheme,
    windows: () => windows.all(),
    background: '#131316',
    overlay: {
        height: 48,
        colors: { dark: { color: '#1b1b1f', symbolColor: '#ececf1' }, light: { color: '#ffffff', symbolColor: '#18181b' } }
    }
});

// `ipc` is the app's createAppIpc, which checks the sender first.
ipc.on('window:theme', (_event, state: ThemeState) => theme.apply(state));

const window = new BrowserWindow({ ...bounds, ...theme.windowOptions(), show: false });
```

`windowOptions()` returns a new window's chrome and background. On macOS that is the inset traffic lights (`trafficLights`, 17 by 17 by default). Elsewhere it is a hidden title bar with the `overlay` controls drawn over the page, or no controls without `overlay`. With `nativeFrame`, a window off macOS keeps the system's own title bar and menu bar, and the overlay colors are never applied. A new window opens in the current theme, or dark with `background` before any page reported one.

`overlay` holds one color pair per theme. A page whose background changes within a theme, such as a palette picker, can report its control colors in `ThemeState.overlay`. Those win over the theme's pair on every window until a state without them arrives. The shell reads only `color` and `symbolColor`. macOS ignores them.

```ts
// In the page, on every change of the theme or the palette.
desktop.setTheme({
    resolved,
    followsSystem,
    background: tokenOf('--bg'),
    overlay: { color: tokenOf('--bg'), symbolColor: tokenOf('--fg') }
});
```

`nativeTheme.themeSource` is `system` only while the app follows the system. Otherwise it is the app's choice, so a page inside a `<webview>` follows the app too.

## Room for the window controls

A page that reaches the top of a macOS window keeps the start of its first column free for the traffic lights, and takes that room back in fullscreen, where macOS hides them. `windowControls(window)` returns a `WindowControlsState` (`@adecore/shell/bridge`): its `inset` is the width to keep free, as far past the lights as `trafficLights` sets them from the edge (86 pixels by default). It is `null` off macOS and in fullscreen.

`followWindowControls(window, send)` calls `send` with a new state each time the window goes in or out of fullscreen, and returns what stops it. The shell registers no channel, so the app sends the state on one of its own and answers a page that asks for it. On the page, [`WindowControlsSpacer`](/ui/layout/window-controls-spacer) draws the room.

`windowControlsOf(platform, options)` (`@adecore/shell/bridge`) computes the same state without a window: `options` takes `fullscreen` and `trafficLights`, a `WindowControlsOptions`. A page starts from it with the platform its preload reports, so the first frame clears the traffic lights before the shell answers.

```ts
// `ipc` is the app's createAppIpc, which checks the sender first.
ipc.handle('window:controls', (event) => theme.windowControls(ipc.senderWindow(event)!));
theme.followWindowControls(window, (state) => window.webContents.send('window:controls', state));
```

`current()` returns the last `ThemeState` applied, or `null` before the first. `createTheme` takes `ThemeOptions`, whose `overlay` is a `TitleBarOverlay`, and returns a `Theme`. The [reference](/shell/reference#themeoptions) lists the options.
