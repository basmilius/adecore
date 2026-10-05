import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, Menu, session, type FileFilter, type IpcMainInvokeEvent, type OpenDialogOptions } from 'electron';
import { createDatabaseHost, spawnHelper } from '@adecore/database/host';
import { CHANNELS, type BrowsePurpose } from '../shared/bridge.ts';
import { ensureDemoDatabase } from './demo.ts';

const appPath = app.getAppPath();
const pagePath = join(appPath, 'dist/renderer/index.html');
const preloadPath = join(appPath, 'dist/preload.cjs');
const helperPath =
    process.env.ADECORE_DATABASE_HELPER ??
    resolve(appPath, '../../packages/database/helper/target/release', process.platform === 'win32' ? 'adecore-database.exe' : 'adecore-database');

/* The files the page may export to or import from: only those a dialog returned in this run, never a path the page names itself. */
const granted = { read: new Set<string>(), write: new Set<string>() };

const FORMAT_FILTERS: Readonly<Record<string, FileFilter>> = {
    csv: { name: 'CSV', extensions: ['csv'] },
    tsv: { name: 'TSV', extensions: ['tsv'] },
    json: { name: 'JSON', extensions: ['json'] },
    sql: { name: 'SQL', extensions: ['sql'] }
};

/* A database file has its extensions; an SSH key has none, and lives in a hidden folder. */
const BROWSE_OPTIONS: Readonly<Record<BrowsePurpose, OpenDialogOptions>> = {
    database: {
        properties: ['openFile'],
        filters: [
            { name: 'SQLite', extensions: ['sqlite', 'db', 'sqlite3'] },
            { name: 'All files', extensions: ['*'] }
        ]
    },
    identity: {
        properties: ['openFile', 'showHiddenFiles'],
        defaultPath: join(homedir(), '.ssh')
    }
};

const host = createDatabaseHost({
    start: () => spawnHelper(helperPath, { onLog: (line) => console.error('[helper]', line) }),
    authorizeFile: (path, access) => granted[access].has(path),
    // The page may list the Docker containers of this machine; the demo's whole point is to connect to them.
    authorizeDiscovery: (kind) => kind === 'docker'
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

    ipcMain.handle(CHANNELS.browse, async (event, purpose: unknown) => {
        assertOwnPage(event);
        if (purpose !== 'database' && purpose !== 'identity') {
            throw new Error('Invalid browse purpose.');
        }
        const options = BROWSE_OPTIONS[purpose];
        const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
        return result.canceled ? null : (result.filePaths[0] ?? null);
    });

    ipcMain.handle(CHANNELS.saveFile, async (event, options: unknown) => {
        assertOwnPage(event);
        const { suggestedName, format } = (options ?? {}) as { suggestedName?: unknown; format?: unknown };
        const filter = typeof format === 'string' ? FORMAT_FILTERS[format] : undefined;
        if (typeof suggestedName !== 'string' || filter === undefined) {
            throw new Error('Invalid save options.');
        }
        const dialogOptions = { defaultPath: basename(suggestedName), filters: [filter] };
        const result = mainWindow ? await dialog.showSaveDialog(mainWindow, dialogOptions) : await dialog.showSaveDialog(dialogOptions);
        if (result.canceled || result.filePath === '') {
            return null;
        }
        granted.write.add(result.filePath);
        return result.filePath;
    });

    ipcMain.handle(CHANNELS.openFile, async (event, options: unknown) => {
        assertOwnPage(event);
        const { formats } = (options ?? {}) as { formats?: unknown };
        const filters = Array.isArray(formats) ? formats.map((format) => (typeof format === 'string' ? FORMAT_FILTERS[format] : undefined)) : [];
        if (filters.length === 0 || filters.some((filter) => filter === undefined)) {
            throw new Error('Invalid open options.');
        }
        const dialogOptions = { properties: ['openFile' as const], filters: filters as FileFilter[] };
        const result = mainWindow ? await dialog.showOpenDialog(mainWindow, dialogOptions) : await dialog.showOpenDialog(dialogOptions);
        const path = result.canceled ? null : (result.filePaths[0] ?? null);
        if (path !== null) {
            granted.read.add(path);
        }
        return path;
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

/* The default menu closes the window on Cmd+W before the page hears it, and the workbench uses that key to close a tab. */
const buildMenu = (): Menu =>
    Menu.buildFromTemplate([
        process.platform === 'darwin' ? { role: 'appMenu' } : { label: 'File', submenu: [{ role: 'quit' }] },
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }] }
    ]);

void app.whenReady().then(() => {
    if (!existsSync(helperPath)) {
        console.error(`[demo] No helper at ${helperPath}. Run "bun run helper" or set ADECORE_DATABASE_HELPER.`);
    }

    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    Menu.setApplicationMenu(buildMenu());
    registerChannels();
    createWindow();
});
