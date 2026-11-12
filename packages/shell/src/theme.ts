import type { BrowserWindow, BrowserWindowConstructorOptions, NativeTheme } from 'electron';
import type { ThemeState } from './bridge/theme.ts';
import { TRAFFIC_LIGHTS, type WindowControlsState, windowControlsOf } from './bridge/window-controls.ts';

/* A window as far as the room for its controls goes: whether it is fullscreen, and when that changes. */
export type ControlsWindow = Pick<BrowserWindow, 'isFullScreen' | 'isDestroyed' | 'on' | 'off'>;

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
    platform?: NodeJS.Platform;
}

/*
 * The theme the pages report, applied to what only the shell paints: every window's ground, so a reload
 * never flashes the other theme, the native controls off macOS, and Chromium's `prefers-color-scheme`.
 */
export const createTheme = (options: ThemeOptions) => {
    const platform = options.platform ?? process.platform;
    const lights = options.trafficLights ?? TRAFFIC_LIGHTS;
    let current: ThemeState | null = null;

    const controlsOf = (window: ControlsWindow): WindowControlsState =>
        windowControlsOf(platform, { fullscreen: window.isFullScreen(), trafficLights: lights });

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

        /* Calls `send` each time the room changes, as the window goes in and out of fullscreen. Returns what stops it. */
        followWindowControls: (window: ControlsWindow, send: (state: WindowControlsState) => void): (() => void) => {
            const changed = () => {
                if (!window.isDestroyed()) {
                    send(controlsOf(window));
                }
            };

            window.on('enter-full-screen', changed);
            window.on('leave-full-screen', changed);

            return () => {
                window.off('enter-full-screen', changed);
                window.off('leave-full-screen', changed);
            };
        }
    };
};

export type Theme = ReturnType<typeof createTheme>;
