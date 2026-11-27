import type { BrowserWindow, BrowserWindowConstructorOptions, NativeTheme } from 'electron';
import type { ThemeState } from './bridge/theme.ts';
import { TRAFFIC_LIGHTS, type WindowControlsState, windowControlsOf } from './bridge/window-controls.ts';
import type { FullScreenTitlebar } from './fullscreen-titlebar.ts';

/*
 * A window as far as the room for its controls goes: whether it is fullscreen, and when that changes.
 * With `fullScreenTitlebar` the theme also needs its native handle.
 */
export type ControlsWindow = Pick<BrowserWindow, 'isFullScreen' | 'isDestroyed' | 'on' | 'off'> & Partial<Pick<BrowserWindow, 'getNativeWindowHandle'>>;

/* What `fullScreenTitlebar` last reported for a fullscreen window. */
interface FullScreenLights {
    revealed: boolean;
    offset: number;
}

/* The native window controls a page leaves room for off macOS, with their colors per theme. */
export interface TitleBarOverlay {
    height: number;
    colors: Record<ThemeState['resolved'], NonNullable<ThemeState['overlay']>>;
}

export interface ThemeOptions {
    nativeTheme: Pick<NativeTheme, 'themeSource'>;
    windows: () => readonly BrowserWindow[];
    /* The ground of a window before any page reported one. */
    background: string;
    /* Off macOS, the controls drawn over the page. Without it the window has no controls of its own there. */
    overlay?: TitleBarOverlay;
    /* Off macOS, the system's own title bar and menu bar instead of a page that reaches the top. */
    nativeFrame?: boolean;
    /* Where macOS puts the traffic lights, inset into the page. */
    trafficLights?: { x: number; y: number };
    /*
     * On macOS, the module of `loadFullScreenTitlebar`. A fullscreen window then fades its traffic lights in over
     * the page as the menu bar comes down, and `followWindowControls` reports the room for them only while they show.
     */
    fullScreenTitlebar?: FullScreenTitlebar | null;
    platform?: NodeJS.Platform;
}

/*
 * The theme the pages report, applied to what only the shell paints: every window's ground, so a reload
 * never flashes the other theme, the native controls off macOS, and Chromium's `prefers-color-scheme`.
 */
export const createTheme = (options: ThemeOptions) => {
    const platform = options.platform ?? process.platform;
    const lights = options.trafficLights ?? TRAFFIC_LIGHTS;
    const titlebar = platform === 'darwin' ? (options.fullScreenTitlebar ?? null) : null;
    // The windows the module follows; outside fullscreen it reports nothing that changes their room.
    const followed = new WeakMap<ControlsWindow, FullScreenLights>();
    let current: ThemeState | null = null;

    const controlsOf = (window: ControlsWindow): WindowControlsState => {
        const fullscreen = window.isFullScreen();
        const lightsShown = followed.get(window);

        if (!fullscreen || lightsShown === undefined) {
            return windowControlsOf(platform, { fullscreen, trafficLights: lights });
        }

        return { ...windowControlsOf(platform, { fullscreen, revealed: lightsShown.revealed, trafficLights: lights }), offset: lightsShown.offset };
    };

    const follow = (window: ControlsWindow, send: (state: WindowControlsState) => void) => {
        const handle = window.getNativeWindowHandle?.();

        if (titlebar === null || handle === undefined) {
            return;
        }

        const attached = titlebar.attach(handle, (revealed, offset) => {
            followed.set(window, { revealed, offset });

            if (!window.isDestroyed() && window.isFullScreen()) {
                send(controlsOf(window));
            }
        });

        if (attached) {
            followed.set(window, { revealed: false, offset: 0 });
        }
    };

    // The colors a page reports win over the ones per theme. Only the two colors are taken from what crossed IPC.
    const overlayOf = (theme: Pick<ThemeState, 'resolved' | 'overlay'>) => {
        if (!options.overlay) {
            return undefined;
        }

        const { color, symbolColor } = theme.overlay ?? options.overlay.colors[theme.resolved];

        return { height: options.overlay.height, color, symbolColor };
    };

    return {
        apply: (theme: ThemeState): void => {
            current = theme;
            options.nativeTheme.themeSource = theme.followsSystem ? 'system' : theme.resolved;
            const overlay = platform === 'darwin' || options.nativeFrame ? undefined : overlayOf(theme);

            for (const window of options.windows()) {
                if (window.isDestroyed()) {
                    continue;
                }

                if (overlay) {
                    window.setTitleBarOverlay(overlay);
                }

                window.setBackgroundColor(theme.background);
            }
        },

        current: (): ThemeState | null => current,

        /* The constructor options of a new window: its own chrome and the ground the others have. Dark until a page says otherwise. */
        windowOptions: (): BrowserWindowConstructorOptions => {
            const overlay = overlayOf(current ?? { resolved: 'dark' });

            const hidden: BrowserWindowConstructorOptions = options.nativeFrame
                ? {}
                : { titleBarStyle: 'hidden', ...(overlay ? { titleBarOverlay: overlay } : {}) };
            const chrome: BrowserWindowConstructorOptions = platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: lights } : hidden;

            return { ...chrome, backgroundColor: current?.background ?? options.background };
        },

        /* The room a page keeps free for the controls of this window, which the app hands its page on a channel of its own. */
        windowControls: controlsOf,

        /*
         * Calls `send` each time the room changes: as the window goes in and out of fullscreen, and with
         * `fullScreenTitlebar` as its lights fade in and out and the menu bar comes down. Returns what stops it.
         */
        followWindowControls: (window: ControlsWindow, send: (state: WindowControlsState) => void): (() => void) => {
            const changed = () => {
                if (!window.isDestroyed()) {
                    send(controlsOf(window));
                }
            };

            // The module follows the window until it closes, so its reports go nowhere once the app stopped.
            let following = true;
            follow(window, (state) => {
                if (following) {
                    send(state);
                }
            });

            window.on('enter-full-screen', changed);
            window.on('leave-full-screen', changed);

            return () => {
                following = false;
                window.off('enter-full-screen', changed);
                window.off('leave-full-screen', changed);
            };
        }
    };
};

export type Theme = ReturnType<typeof createTheme>;
