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

`windowControlsOf(platform, options)` (`@adecore/shell/bridge`) computes the same state without a window: `options` takes `fullscreen`, `revealed` and `trafficLights`, a `WindowControlsOptions`. A page starts from it with the platform its preload reports, so the first frame clears the traffic lights before the shell answers.

```ts
// `ipc` is the app's createAppIpc, which checks the sender first.
ipc.handle('window:controls', (event) => theme.windowControls(ipc.senderWindow(event)!));
theme.followWindowControls(window, (state) => window.webContents.send('window:controls', state));
```

### Traffic lights in fullscreen

Without a toolbar, a fullscreen macOS window slides a title bar strip with its title down over the page when the pointer reaches the menu bar. A native app with a toolbar shows only its traffic lights: they fade in over the page at the place they have outside fullscreen. A small native module gives an Electron window the same. Hand it to `createTheme` as `fullScreenTitlebar`, and `followWindowControls` follows each window it is given:

- In fullscreen, `inset` is the room for the lights while they show and `null` while they are hidden. The lights fade in as the menu bar comes down, and the state changes as the fade-in starts. It changes back once they faded out, so the room stays until they are gone.
- `offset` is how far the menu bar pushes the top of the window down. On a display without a notch the menu bar comes down over the page, and a page moves its top bar down with it, as a native toolbar does. The state comes once per frame while that happens. On a display with a notch it stays 0.
- Clicks in the top of the page reach the page, except over the lights while they show.

The module is Objective-C, shipped as source in the package's `native` folder, so the app compiles it in its own build with `buildFullScreenTitlebar({ outfile, arch })`, a `FullScreenTitlebarBuild`. That needs the Xcode command line tools and nothing else, and the module runs on macOS 14 and later. In the main process, `loadFullScreenTitlebar(path)` loads it. It returns `null` off macOS and when the file is missing, and the window then keeps macOS's own strip.

```ts
// In the app's build script, on macOS.
buildFullScreenTitlebar({ outfile: 'dist/native/fullscreen-titlebar.node', arch: 'arm64' });

// In the main process.
const theme = createTheme({
    nativeTheme,
    windows: () => windows.all(),
    background: '#131316',
    fullScreenTitlebar: loadFullScreenTitlebar(join(process.resourcesPath, 'native', 'fullscreen-titlebar.node'))
});
```

A native module cannot load from inside an asar archive, and a signed app signs the `.node` file like any other binary it ships.

`current()` returns the last `ThemeState` applied, or `null` before the first. `createTheme` takes `ThemeOptions`, whose `overlay` is a `TitleBarOverlay`, and returns a `Theme`. The [reference](/shell/reference#themeoptions) lists the options.
