import type { BrowserWindow, Rectangle, WebContents } from 'electron';
import type { WindowSize, WindowState, WindowStateStorage } from './window-state.ts';

/* The key a window that shows no project keeps its bounds under, such as a start screen. */
export const UNKEYED_STATE = 'start';

/* How far a new window sits from the one in front, when its key has no bounds of its own. */
export const CASCADE = 24;

export interface WindowsOptions {
    state: WindowState;
    /* Which windows were open when the app last quit, so a cold start opens them again. */
    session: WindowStateStorage;
    /* Builds the app's window for a key and loads it. The bounds go into the constructor. */
    create: (key: string | null, bounds: Partial<Rectangle> & WindowSize) => BrowserWindow;
}

interface Entry {
    window: BrowserWindow;
    key: string | null;
}

const SESSION_VERSION = 1;

const parseSession = (text: string | null): (string | null)[] => {
    if (text === null) {
        return [];
    }
    try {
        const file = JSON.parse(text) as { version?: unknown; windows?: unknown };
        if (file.version !== SESSION_VERSION || !Array.isArray(file.windows)) {
            return [];
        }
        const keys = file.windows.filter((key): key is string | null => key === null || (typeof key === 'string' && key !== ''));
        // A key belongs to one window, so a file that lists one twice keeps the last.
        return keys.filter((key, index) => key === null || keys.lastIndexOf(key) === index);
    } catch {
        return [];
    }
};

/*
 * The app's windows, each showing what its key names (a project, say) or nothing yet (null). A key
 * belongs to one window at a time: opening it again raises the window that has it. The page tells
 * the shell what it shows through `claim`, since a window can come to show another key over time.
 */
export const createWindows = (options: WindowsOptions) => {
    const entries = new Map<number, Entry>();
    // Least recently in front first, so the last one is the window in front.
    let order: number[] = [];
    // A `<webview>` has no window of its own in Electron, so the page that attaches one names it.
    const guestOwners = new Map<number, number>();
    let quitting = false;

    const alive = (): Entry[] => [...entries.values()].filter((entry) => !entry.window.isDestroyed());

    const writeSession = (): void => {
        if (quitting) {
            return;
        }
        const keys = order.map((id) => entries.get(id)?.key ?? null);
        options.session.write(`${JSON.stringify({ version: SESSION_VERSION, windows: keys }, null, 2)}\n`);
    };

    const toFront = (id: number): void => {
        order = [...order.filter((other) => other !== id), id];
    };

    const focused = (): BrowserWindow | null => {
        for (let i = order.length - 1; i >= 0; i--) {
            const entry = entries.get(order[i]!);
            if (entry && !entry.window.isDestroyed()) {
                return entry.window;
            }
        }
        return null;
    };

    const holderOf = (key: string): Entry | null => alive().find((entry) => entry.key === key) ?? null;

    const raise = (window: BrowserWindow): void => {
        if (window.isMinimized()) {
            window.restore();
        }
        window.show();
        window.focus();
    };

    const boundsFor = (key: string | null): Partial<Rectangle> & WindowSize => {
        const stateKey = key ?? UNKEYED_STATE;
        const front = focused();
        if (options.state.has(stateKey) || !front) {
            return options.state.bounds(stateKey);
        }
        const beside = front.getNormalBounds();
        return options.state.bounds(stateKey, { ...beside, x: beside.x + CASCADE, y: beside.y + CASCADE });
    };

    const create = (key: string | null): BrowserWindow => {
        const window = options.create(key, boundsFor(key));
        const entry: Entry = { window, key };
        const id = window.id;
        entries.set(id, entry);
        toFront(id);
        options.state.track(() => entry.key ?? UNKEYED_STATE, window);
        window.on('focus', () => {
            toFront(id);
            writeSession();
        });
        window.on('closed', () => {
            entries.delete(id);
            order = order.filter((other) => other !== id);
            for (const [guest, owner] of guestOwners) {
                if (owner === id) {
                    guestOwners.delete(guest);
                }
            }
            writeSession();
        });
        window.webContents.on('did-attach-webview', (_event, guest) => {
            guestOwners.set(guest.id, id);
            guest.once('destroyed', () => guestOwners.delete(guest.id));
        });
        writeSession();
        return window;
    };

    return {
        /* Raises the window that has the key, or opens one for it. Null always opens a new window. */
        open: (key: string | null): BrowserWindow => {
            const holder = key === null ? null : holderOf(key);
            if (holder) {
                raise(holder.window);
                return holder.window;
            }
            return create(key);
        },

        /* Opens the windows that were open when the app last quit, or one without a key. */
        restore: (): void => {
            const keys = parseSession(options.session.read());
            for (const key of keys.length > 0 ? keys : [null]) {
                create(key);
            }
        },

        /*
         * Makes a window the one that shows a key, as when its page opens a project. False when another
         * window already has it; that window comes to the front instead. Null lets the key go.
         */
        claim: (window: BrowserWindow, key: string | null): boolean => {
            const entry = entries.get(window.id);
            if (!entry) {
                return false;
            }
            const holder = key === null ? null : holderOf(key);
            if (holder && holder !== entry) {
                raise(holder.window);
                return false;
            }
            entry.key = key;
            writeSession();
            return true;
        },

        /* The window a page or a `<webview>` inside it belongs to: who sent an IPC message, or whose menu a guest opens. */
        fromContents: (contents: WebContents): BrowserWindow | null => {
            const guestOwner = guestOwners.get(contents.id);
            if (guestOwner !== undefined) {
                return entries.get(guestOwner)?.window ?? null;
            }
            return alive().find((entry) => entry.window.webContents === contents)?.window ?? null;
        },

        /* The window last in front, for what has no sender: a second instance, a notification, a menu command. */
        focused,

        keyOf: (window: BrowserWindow): string | null => entries.get(window.id)?.key ?? null,

        all: (): BrowserWindow[] => alive().map((entry) => entry.window),

        /* Sends to the page of every window, for what the whole app shares, such as where updating stands. */
        send: (channel: string, ...args: unknown[]): void => {
            for (const entry of alive()) {
                if (!entry.window.webContents.isDestroyed()) {
                    entry.window.webContents.send(channel, ...args);
                }
            }
        },

        /* From the moment the app quits, windows that close stay in the session, so the next start opens them again. */
        quit: (): void => {
            writeSession();
            quitting = true;
        }
    };
};

export type Windows = ReturnType<typeof createWindows>;
