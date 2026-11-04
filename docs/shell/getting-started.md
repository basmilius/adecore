# Getting started

This page wires a main process with the shell: the page served from its own scheme, a set of windows, the theme, the menu, the updater and the guards. Then it exposes the channels to the page through a preload.

## Install

Electron and electron-updater are peer dependencies, so the app picks their version:

```sh
bun add @adecore/shell electron electron-updater
```

The package has no styles. Its main entry point runs in the main process. `@adecore/shell/bridge` imports nothing from Electron, so the preload and the page import it as well.

## The main process

The example below is one `main.ts`. The channel names (`menu:set`, `update:check`, ...) are the app's own; only `menu:run` is a channel the package sends on. `CSP`, `iconsFor` and the folders stand for what the app already has.

```ts
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, Menu, nativeTheme, protocol, screen, session, shell } from 'electron';
import {
    createAppIpc,
    createAppScheme,
    createGestureGate,
    createMenuCommands,
    createPageKeys,
    createTheme,
    createUpdater,
    createWindows,
    createWindowState,
    devToolsAccelerator,
    fileStorage,
    isExternalLink,
    menuTemplateOf,
    staticMenuTemplate
} from '@adecore/shell';
import type { MenuSpec, ThemeState } from '@adecore/shell/bridge';

type ShellAction = 'devtools';

const userData = app.getPath('userData');

// 1. The page, served from app://app. Privileges go to Electron before it is ready.
const scheme = createAppScheme({
    scheme: 'app',
    root: join(__dirname, '../client'),
    headers: { 'content-security-policy': CSP },
    pageUrl: process.env.DEV_SERVER_URL
});

protocol.registerSchemesAsPrivileged([scheme.privileged]);

// 2. The theme the page reports, applied to every window.
const theme = createTheme({
    nativeTheme,
    windows: () => windows.all(),
    background: '#131316',
    overlay: {
        height: 40,
        colors: { dark: { color: '#131316', symbolColor: '#ececf1' }, light: { color: '#ffffff', symbolColor: '#18181b' } }
    }
});

// 3. Keys the page already handled, so the menu does not answer them twice.
const pageKeys = createPageKeys();

// 4. The windows, one per key, each where it was left.
const windows = createWindows({
    state: createWindowState({
        storage: fileStorage(join(userData, 'window-state.json')),
        displays: () => screen.getAllDisplays(),
        defaults: { width: 1440, height: 900 }
    }),
    session: fileStorage(join(userData, 'window-session.json')),
    create: (key, bounds, origin, state) => {
        const window = new BrowserWindow({
            ...bounds,
            ...theme.windowOptions(),
            minWidth: 800,
            minHeight: 500,
            show: false,
            webPreferences: { preload: join(__dirname, 'preload.js') }
        });
        const contents = window.webContents;
        const gesture = createGestureGate();

        contents.on('before-input-event', (_event, input) => pageKeys.saw(input));
        contents.on('input-event', (_event, input) => gesture.saw(input.type));

        contents.on('will-navigate', (event) => {
            const verdict = scheme.navigation(event.url);

            if (verdict === 'allow') {
                return;
            }

            event.preventDefault();

            if (verdict === 'external') {
                void shell.openExternal(event.url);
            }
        });

        contents.setWindowOpenHandler(({ url }) => {
            if (isExternalLink(url) && gesture.consume()) {
                void shell.openExternal(url);
            }

            return { action: 'deny' };
        });

        window.once('ready-to-show', () => window.show());
        void window.loadURL(urlFor(scheme.url, key, origin, state));

        return window;
    }
});

// 5. The updater, which tells every window where updating stands.
const updater = createUpdater({
    currentVersion: app.getVersion(),
    packaged: app.isPackaged,
    load: () => require('electron-updater').autoUpdater,
    publish: (state) => windows.send('update:state', state),
    onQuit: windows.quitForUpdate
});

// 6. Every channel behind one check: the top frame of an app window, on the app's origin.
const ipc = createAppIpc(
    ipcMain,
    (event) => scheme.isAppSender(windows.fromPage(event.sender) !== null, event.senderFrame),
    (contents) => windows.fromPage(contents)
);

const runCommand = createMenuCommands({ pageKeys, window: () => windows.focused() });

ipc.on('menu:set', (_event, spec: MenuSpec<ShellAction>) => {
    const template = menuTemplateOf(spec, {
        run: runCommand,
        shellItem: (action, label) =>
            action === 'devtools' ? { label, accelerator: devToolsAccelerator(), click: () => windows.focused()?.webContents.toggleDevTools() } : null
    });

    if (template) {
        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    }
});

ipc.on('window:theme', (_event, state: ThemeState) => theme.apply(state));
ipc.handle('window:claim', (event, key: unknown) => {
    const window = ipc.senderWindow(event);

    return window !== null && (key === null || typeof key === 'string') && windows.claim(window, key);
});

ipc.handle('update:state', () => updater.state());
ipc.on('update:configure', (_event, autoDownload: unknown) => updater.configure(autoDownload));
ipc.handle('update:check', () => updater.check());
ipc.handle('update:download', () => updater.download());
ipc.on('update:install', () => updater.install());

// 7. App events, before ready. Then the fixed menu, the scheme and the last session.
windows.attach(app);

app.whenReady().then(() => {
    Menu.setApplicationMenu(
        Menu.buildFromTemplate(
            staticMenuTemplate({
                appName: app.name,
                toggleDevTools: () => windows.focused()?.webContents.toggleDevTools(),
                fileItems: [{ label: 'New Window', accelerator: 'CommandOrControl+Shift+N', click: () => windows.open(null) }]
            })
        )
    );

    session.defaultSession.protocol.handle(scheme.scheme, scheme.handle);
    windows.restore();
    updater.start();
});
```

What each step does:

1. The [app scheme](/shell/app-scheme) serves the built page and binds its origin to the guards. With `pageUrl` set, the window loads the dev server instead.
2. The [theme](/shell/theme) gives a new window its chrome and background, and repaints every window when the page reports a change.
3. The page keys let the [application menu](/shell/menu#a-key-the-page-already-had) drop a key the page already answered.
4. The [windows](/shell/windows) open the windows of the last session. `create` builds and loads each one, and wires the [navigation guards](/shell/navigation) to its page.
5. The [updater](/shell/updater) stays `unsupported` in a checkout. In a packaged app, nothing downloads until the page calls `update:configure`.
6. [`createAppIpc`](/shell/ipc) refuses every page that is not the app. The menu the page sends becomes the application menu.
7. `attach` follows the second instance, the dock icon and the quit. `staticMenuTemplate` stands until the page sends its menu.

## The preload

The preload hands the page a small object. `ipcSubscriber` turns a channel the main process sends on into a subscribe function that never passes the event to the page:

```ts
import { contextBridge, ipcRenderer } from 'electron';
import { ipcSubscriber, type MenuSpec, type ThemeState, type UpdateState } from '@adecore/shell/bridge';

const subscribe = ipcSubscriber(ipcRenderer);

contextBridge.exposeInMainWorld('desktop', {
    setMenu: (spec: MenuSpec) => ipcRenderer.send('menu:set', spec),
    onMenuCommand: subscribe<[id: string]>('menu:run'),
    setTheme: (state: ThemeState) => ipcRenderer.send('window:theme', state),
    claim: (key: string | null): Promise<boolean> => ipcRenderer.invoke('window:claim', key),
    update: {
        state: (): Promise<UpdateState> => ipcRenderer.invoke('update:state'),
        onState: subscribe<[state: UpdateState]>('update:state'),
        configure: (autoDownload: boolean) => ipcRenderer.send('update:configure', autoDownload),
        check: () => ipcRenderer.invoke('update:check'),
        download: () => ipcRenderer.invoke('update:download'),
        install: () => ipcRenderer.send('update:install')
    }
});
```

## The page

The page sends its menu when focus changes, runs the command a pick sends back, reports its theme and turns on the updater with the person's preference:

```ts
desktop.setMenu({
    menus: [
        {
            id: 'file',
            label: 'File',
            items: [
                { kind: 'command', id: 'project.new', label: 'New project', accelerator: 'CommandOrControl+N' },
                { kind: 'separator' },
                { kind: 'role', role: 'quit', label: 'Quit' }
            ]
        },
        { id: 'view', label: 'View', items: [{ kind: 'shell', action: 'devtools', label: 'Developer tools' }] }
    ]
});

const stop = desktop.onMenuCommand((id) => commands.run(id));

desktop.setTheme({ resolved: 'dark', followsSystem: true, background: '#131316' });
desktop.update.configure(settings.autoDownload);
```

## Checklist

- `protocol.registerSchemesAsPrivileged` runs before the app is ready, and `protocol.handle` after.
- `attach` runs before `app.whenReady()`, `restore` once ready.
- Every channel goes through `createAppIpc`, or checks `isAppSender` first.
- `create` wires `will-navigate` and the window open handler for every window.
- The page calls `configure` on the updater once, with the person's preference, or the updater never checks.
- `second-instance` only fires after `app.requestSingleInstanceLock()`, which the app calls itself.
