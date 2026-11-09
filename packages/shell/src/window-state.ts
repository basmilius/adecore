import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { writeAtomicSync } from '@adecore/utils/fs';
import type { BrowserWindow, Rectangle } from 'electron';

export interface WindowSize {
    width: number;
    height: number;
}

/* Where a window stood and how, as a person left it. The bounds are its normal ones, also while maximized or in full screen. */
export interface SavedWindow {
    x: number;
    y: number;
    width: number;
    height: number;
    maximized: boolean;
    fullScreen: boolean;
}

export interface WindowDisplay {
    readonly workArea: Rectangle;

    /* The whole display, which a window in full screen covers. Without it, every window in full screen counts as on a display. */
    readonly bounds?: Rectangle;
}

/* How much of a window has to stay on a display to count as reachable: enough of the title bar to grab it. */
const VISIBLE_EDGE = { width: 100, height: 40 };

const overlap = (a: Rectangle, b: Rectangle): WindowSize => ({
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
});

export const reachableOn = (bounds: Rectangle, displays: readonly WindowDisplay[]): WindowDisplay | null =>
    displays.find(({ workArea }) => {
        const shared = overlap(bounds, workArea);

        return shared.width >= Math.min(VISIBLE_EDGE.width, bounds.width) && shared.height >= Math.min(VISIBLE_EDGE.height, bounds.height);
    }) ?? null;

/*
 * Saved bounds stand while a display still shows enough of them to grab, shrunk to its work area;
 * otherwise, or for null, the window opens at its default size, which Electron centers.
 */
export const fitBounds = (saved: Rectangle | null, displays: readonly WindowDisplay[], defaults: WindowSize): Partial<Rectangle> & WindowSize => {
    if (saved) {
        const display = reachableOn(saved, displays);

        if (display) {
            const area = display.workArea;
            const width = Math.min(saved.width, area.width);
            const height = Math.min(saved.height, area.height);

            return {
                x: Math.min(Math.max(saved.x, area.x), area.x + area.width - width),
                y: Math.min(Math.max(saved.y, area.y), area.y + area.height - height),
                width,
                height
            };
        }
    }

    return { width: defaults.width, height: defaults.height };
};

export type StateWindow = Pick<
    BrowserWindow,
    'getNormalBounds' | 'isMaximized' | 'isFullScreen' | 'isDestroyed' | 'maximize' | 'setFullScreen' | 'on' | 'once'
>;

export interface WindowStateStorage {
    read(): string | null;
    write(text: string): void;
}

/* Every write takes a temp name of its own, so one a hard kill left behind is never overwritten; the storage clears them before its first write. */
const removeLeftoverTemps = (path: string): void => {
    const name = basename(path);
    const folder = dirname(path);

    try {
        for (const entry of readdirSync(folder)) {
            if (entry.startsWith(`${name}.`) && entry.endsWith('.tmp')) {
                rmSync(join(folder, entry), { force: true });
            }
        }
    } catch {
        // A folder that is not there yet holds nothing to clear.
    }
};

/* A JSON file, written through a file beside it so a crash halfway leaves the last whole one. */
export const fileStorage = (path: string): WindowStateStorage => {
    removeLeftoverTemps(path);

    return {
        read: () => {
            try {
                return readFileSync(path, 'utf8');
            } catch {
                return null;
            }
        },
        // The write runs in a timer of the main process, which has no promise to wait on.
        write: (text) => writeAtomicSync(path, text, 0o666)
    };
};

export interface WindowStateOptions {
    storage: WindowStateStorage;
    /* `screen.getAllDisplays` of Electron, asked at every open, since displays come and go while the app runs. */
    displays: () => readonly WindowDisplay[];
    defaults: WindowSize;
    /* How long a window has to stand still before its bounds are written. */
    delayMs?: number;
    setTimeout?: (run: () => void, ms: number) => unknown;
    clearTimeout?: (timer: unknown) => void;
}

const FILE_VERSION = 1;

const isSaved = (value: unknown): value is SavedWindow => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const saved = value as Record<string, unknown>;

    const whole = (key: string): boolean => Number.isInteger(saved[key]);

    return whole('x') && whole('y') && whole('width') && whole('height') && (saved.width as number) > 0 && (saved.height as number) > 0;
};

const parse = (text: string | null): Map<string, SavedWindow> => {
    const windows = new Map<string, SavedWindow>();

    if (text === null) {
        return windows;
    }

    try {
        const file = JSON.parse(text) as { version?: unknown; windows?: Record<string, unknown> };

        if (file.version !== FILE_VERSION || typeof file.windows !== 'object' || file.windows === null) {
            return windows;
        }

        for (const [key, value] of Object.entries(file.windows)) {
            if (isSaved(value)) {
                windows.set(key, { ...value, maximized: value.maximized === true, fullScreen: value.fullScreen === true });
            }
        }
    } catch {
        // A file that does not parse is a first start: every window opens at its default.
    }

    return windows;
};

/* Keeps where each window stood by a key the app chooses, written a moment after it stops moving and when it closes. */
export const createWindowState = (options: WindowStateOptions) => {
    const delayMs = options.delayMs ?? 500;
    const later = options.setTimeout ?? ((run, ms) => setTimeout(run, ms));
    const cancel = options.clearTimeout ?? ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
    const windows = parse(options.storage.read());
    let timer: unknown = null;

    const flush = (): void => {
        if (timer !== null) {
            cancel(timer);
            timer = null;
        }

        options.storage.write(`${JSON.stringify({ version: FILE_VERSION, windows: Object.fromEntries(windows) }, null, 2)}\n`);
    };

    const schedule = (): void => {
        if (timer !== null) {
            cancel(timer);
        }

        timer = later(() => {
            timer = null;
            flush();
        }, delayMs);
    };

    return {
        /* The bounds to construct the window with. `fallback` stands in for a key that has none saved, such as a spot beside another window. */
        bounds: (key: string, fallback: Rectangle | null = null): Partial<Rectangle> & WindowSize =>
            fitBounds(windows.get(key) ?? fallback, options.displays(), options.defaults),

        /*
         * Call right after constructing the window, before it is shown; it is maximized or put in full screen
         * as it was left. A key given as a function is asked at every change, for a window that shows another.
         */
        track: (key: string | (() => string), window: StateWindow): void => {
            const keyNow = typeof key === 'function' ? key : () => key;
            const last = windows.get(keyNow());

            window.once('ready-to-show', () => {
                if (last?.fullScreen) {
                    window.setFullScreen(true);
                } else if (last?.maximized) {
                    window.maximize();
                }
            });

            const remember = (): boolean => {
                if (window.isDestroyed()) {
                    return false;
                }

                const bounds = window.getNormalBounds();
                windows.set(keyNow(), { ...bounds, maximized: window.isMaximized(), fullScreen: window.isFullScreen() });

                return true;
            };

            const changed = (): void => {
                if (remember()) {
                    schedule();
                }
            };

            window.on('resize', changed);
            window.on('move', changed);
            window.on('maximize', changed);
            window.on('unmaximize', changed);
            window.on('enter-full-screen', changed);
            window.on('leave-full-screen', changed);

            window.on('close', () => {
                remember();
                flush();
            });
        },

        has: (key: string): boolean => windows.has(key),

        displays: (): readonly WindowDisplay[] => options.displays(),

        /* Bounds moved onto a display the way a window opens; only a size when no display shows enough of them. */
        fit: (bounds: Rectangle): Partial<Rectangle> & WindowSize => fitBounds(bounds, options.displays(), options.defaults),

        /* Writes what is pending at once, for the moment the app quits. */
        flush: (): void => {
            if (timer !== null) {
                flush();
            }
        }
    };
};

export type WindowState = ReturnType<typeof createWindowState>;
