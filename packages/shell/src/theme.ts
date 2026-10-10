import type { BrowserWindow, BrowserWindowConstructorOptions, NativeTheme } from 'electron';
import type { ThemeState } from './bridge/theme.ts';

/* The native window controls a page leaves room for off macOS, with their colors per theme. */
export interface TitleBarOverlay {
    height: number;
    colors: Record<ThemeState['resolved'], { color: string; symbolColor: string }>;
}

export interface ThemeOptions {
    nativeTheme: Pick<NativeTheme, 'themeSource'>;
    windows: () => readonly BrowserWindow[];
    /* The ground of a window before any page reported one. */
    background: string;
    /* Off macOS, the controls drawn over the page. Without it the window has no controls of its own there. */
    overlay?: TitleBarOverlay;
    /* Where macOS puts the traffic lights, inset into the page. */
    trafficLights?: { x: number; y: number };
    platform?: NodeJS.Platform;
}

/*
 * The theme the pages report, applied to what only the shell can paint: the ground of every window, so
 * a reload or a resize never flashes the other theme, the native controls off macOS, and the
 * `prefers-color-scheme` Chromium answers, which follows the app instead of the system it runs on.
 * A new window opens in the theme the others are in.
 */
export const createTheme = (options: ThemeOptions) => {
    const platform = options.platform ?? process.platform;
    let current: ThemeState | null = null;

    const overlayOf = (resolved: ThemeState['resolved']) =>
        options.overlay ? { height: options.overlay.height, ...options.overlay.colors[resolved] } : undefined;

    return {
        apply: (theme: ThemeState): void => {
            current = theme;
            options.nativeTheme.themeSource = theme.followsSystem ? 'system' : theme.resolved;
            const overlay = platform === 'darwin' ? undefined : overlayOf(theme.resolved);
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
            const resolved = current?.resolved ?? 'dark';
            const overlay = overlayOf(resolved);
            const chrome: BrowserWindowConstructorOptions =
                platform === 'darwin'
                    ? { titleBarStyle: 'hiddenInset', trafficLightPosition: options.trafficLights ?? { x: 17, y: 17 } }
                    : { titleBarStyle: 'hidden', ...(overlay ? { titleBarOverlay: overlay } : {}) };
            return { ...chrome, backgroundColor: current?.background ?? options.background };
        }
    };
};

export type Theme = ReturnType<typeof createTheme>;
