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

// The app's own handler, behind its check of the sender.
onFromApp('window:theme', (_event, state: ThemeState) => theme.apply(state));

const window = new BrowserWindow({ ...bounds, ...theme.windowOptions(), show: false });
```

`windowOptions()` returns a new window's chrome and background. On macOS that is the inset traffic lights (`trafficLights`, 17 by 17 by default). Elsewhere it is a hidden title bar with the `overlay` controls drawn over the page, or no controls without `overlay`. A new window opens in the current theme, or dark with `background` before any page reported one.

`overlay` holds one color pair per theme. A page whose background changes within a theme, such as a palette picker, can report its control colors in `ThemeState.overlay`. Those win over the theme's pair on every window until a state without them arrives. Only `color` and `symbolColor` are read. macOS ignores them.

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

`current()` returns the last `ThemeState` applied, or `null` before the first. `Theme`, `ThemeOptions` and `TitleBarOverlay` are exported types.
