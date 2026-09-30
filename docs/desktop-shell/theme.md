# Theme

The page owns its theme, light or dark, following the system or not, and reports it to the shell as a `ThemeState` (`@basmilius/desktop-shell/bridge`). `createTheme` paints what only the shell can: the ground of every window, so a reload or a resize never flashes the other theme, the native window controls off macOS, and the `prefers-color-scheme` Chromium answers, so a page follows the app instead of the system it runs on.

```ts
import { createTheme } from '@basmilius/desktop-shell';

const theme = createTheme({
    nativeTheme,
    windows: () => windows.all(),
    background: '#131316',
    overlay: {
        height: 48,
        colors: { dark: { color: '#1b1b1f', symbolColor: '#ececf1' }, light: { color: '#ffffff', symbolColor: '#18181b' } }
    }
});

onFromApp('window:theme', (_event, state: ThemeState) => theme.apply(state));

const window = new BrowserWindow({ ...bounds, ...theme.windowOptions(), show: false });
```

`windowOptions()` is a new window's chrome and ground: the traffic lights inset on macOS (`trafficLights`, 17 by 17 by default), elsewhere a hidden title bar with the controls of `overlay` drawn over the page, or none without it. A new window opens in the theme the others are in, and dark with `background` before any page reported one.

`nativeTheme.themeSource` is `system` only while the app follows the system; otherwise it is the app's own choice, since a page inside a `<webview>` asks Chromium and not the app.
