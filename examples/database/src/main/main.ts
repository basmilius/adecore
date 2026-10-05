import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, session, type IpcMainInvokeEvent } from 'electron';
import { createDatabaseHost, spawnHelper } from '@adecore/database/host';
import { CHANNELS } from '../shared/bridge.ts';
import { ensureDemoDatabase } from './demo.ts';

const appPath = app.getAppPath();
const pagePath = join(appPath, 'dist/renderer/index.html');
const preloadPath = join(appPath, 'dist/preload.cjs');
const helperPath =
    process.env.ADECORE_DATABASE_HELPER ??
    resolve(appPath, '../../packages/database/helper/target/release', process.platform === 'win32' ? 'adecore-database.exe' : 'adecore-database');

const host = createDatabaseHost({
    start: () => spawnHelper(helperPath, { onLog: (line) => console.error('[helper]', line) })
});

let mainWindow: BrowserWindow | null = null;
let demoReady: Promise<string> | null = null;

const isPageUrl = (url: string): boolean => {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'file:' && fileURLToPath(parsed) === pagePath;
    } catch {
        return false;
    }
};

/* The page carries the whole bridge, so only the top frame of the app's window, still on the app's own file, may use it. */
const assertOwnPage = (event: IpcMainInvokeEvent): void => {
    const frame = event.senderFrame;

    if (mainWindow === null || event.sender !== mainWindow.webContents || frame === null || frame.parent !== null || !isPageUrl(frame.url)) {
        throw new Error('Request from an untrusted sender.');
    }
};

const demoDatabase = (): Promise<string> => {
    demoReady ??= (async () => {
        const path = join(app.getPath('userData'), 'demo.sqlite');
        await ensureDemoDatabase(host, path);
        return path;
    })().catch((e: unknown) => {
        demoReady = null;
        throw e;
    });

    return demoReady;
};

const registerChannels = (): void => {
    ipcMain.handle(CHANNELS.request, (event, request: unknown) => {
        assertOwnPage(event);
        return host.handle(request, `window:${event.sender.id}`);
    });

    ipcMain.handle(CHANNELS.browse, async (event) => {
        assertOwnPage(event);
        const options = {
            properties: ['openFile' as const],
            filters: [
                { name: 'SQLite', extensions: ['sqlite', 'db', 'sqlite3'] },
                { name: 'All files', extensions: ['*'] }
            ]
        };
        const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
        return result.canceled ? null : (result.filePaths[0] ?? null);
    });

    ipcMain.handle(CHANNELS.demoPath, (event) => {
        assertOwnPage(event);
        return demoDatabase();
    });
};

const createWindow = (): void => {
    const window = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 720,
        minHeight: 480,
        title: 'adecore database',
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false
        }
    });
    const contents = window.webContents;
    const owner = `window:${contents.id}`;
    mainWindow = window;

    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event, url) => {
        if (!isPageUrl(url)) {
            event.preventDefault();
        }
    });
    contents.once('destroyed', () => {
        void host.release(owner);
    });
    window.on('closed', () => {
        mainWindow = null;
    });

    void window.loadFile(pagePath);
};

let disposed = false;

app.on('before-quit', (event) => {
    if (disposed) {
        return;
    }

    event.preventDefault();
    disposed = true;
    void host.dispose().finally(() => app.quit());
});

app.on('window-all-closed', () => {
    app.quit();
});

void app.whenReady().then(() => {
    if (!existsSync(helperPath)) {
        console.error(`[demo] No helper at ${helperPath}. Run "bun run helper" or set ADECORE_DATABASE_HELPER.`);
    }

    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    registerChannels();
    createWindow();
});
