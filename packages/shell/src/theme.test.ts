import { describe, expect, test } from 'bun:test';
import type { BrowserWindow } from 'electron';
import { createTheme, type ControlsWindow } from './theme.ts';

const fakeWindow = (destroyed = false) => {
    const calls: unknown[][] = [];

    const window = {
        isDestroyed: () => destroyed,
        setTitleBarOverlay: (overlay: unknown) => void calls.push(['overlay', overlay]),
        setBackgroundColor: (color: string) => void calls.push(['background', color])
    };

    return { window: window as unknown as BrowserWindow, calls };
};

const OVERLAY = { height: 48, colors: { dark: { color: '#1b1b1f', symbolColor: '#ececf1' }, light: { color: '#ffffff', symbolColor: '#18181b' } } };
const LIGHT = { resolved: 'light', followsSystem: false, background: '#fafafa' } as const;

describe('createTheme', () => {
    test('paints every window that is still there, and tells Chromium which scheme the app is in', () => {
        const nativeTheme = { themeSource: 'system' as 'system' | 'light' | 'dark' };
        const [one, gone] = [fakeWindow(), fakeWindow(true)];
        const theme = createTheme({ nativeTheme, windows: () => [one.window, gone.window], background: '#131316', platform: 'darwin' });
        theme.apply(LIGHT);
        expect(nativeTheme.themeSource).toBe('light');
        expect(one.calls).toEqual([['background', '#fafafa']]);
        expect(gone.calls).toEqual([]);
        theme.apply({ ...LIGHT, followsSystem: true });
        expect(nativeTheme.themeSource).toBe('system');
    });

    test('colors the native controls off macOS', () => {
        const one = fakeWindow();

        const theme = createTheme({
            nativeTheme: { themeSource: 'system' },
            windows: () => [one.window],
            background: '#131316',
            overlay: OVERLAY,
            platform: 'linux'
        });

        theme.apply(LIGHT);

        expect(one.calls).toEqual([
            ['overlay', { height: 48, color: '#ffffff', symbolColor: '#18181b' }],
            ['background', '#fafafa']
        ]);
    });

    test('a new window opens dark on the default ground, and in the theme the others are in once a page reported one', () => {
        const theme = createTheme({ nativeTheme: { themeSource: 'system' }, windows: () => [], background: '#131316', overlay: OVERLAY, platform: 'linux' });

        expect(theme.windowOptions()).toEqual({
            titleBarStyle: 'hidden',
            titleBarOverlay: { height: 48, color: '#1b1b1f', symbolColor: '#ececf1' },
            backgroundColor: '#131316'
        });

        theme.apply(LIGHT);

        expect(theme.windowOptions()).toEqual({
            titleBarStyle: 'hidden',
            titleBarOverlay: { height: 48, color: '#ffffff', symbolColor: '#18181b' },
            backgroundColor: '#fafafa'
        });
        expect(theme.current()).toEqual(LIGHT);
    });

    test('the controls take the colors a page reports, on every window and on one opened later', () => {
        const one = fakeWindow();

        const theme = createTheme({
            nativeTheme: { themeSource: 'system' },
            windows: () => [one.window],
            background: '#131316',
            overlay: OVERLAY,
            platform: 'win32'
        });

        const tinted = { ...LIGHT, background: '#f4efe6', overlay: { color: '#f4efe6', symbolColor: '#2b2118' } };
        theme.apply(tinted);

        expect(one.calls).toEqual([
            ['overlay', { height: 48, color: '#f4efe6', symbolColor: '#2b2118' }],
            ['background', '#f4efe6']
        ]);
        expect(theme.windowOptions()).toEqual({
            titleBarStyle: 'hidden',
            titleBarOverlay: { height: 48, color: '#f4efe6', symbolColor: '#2b2118' },
            backgroundColor: '#f4efe6'
        });
    });

    test('without colors of its own a page gets the ones of its theme again', () => {
        const one = fakeWindow();

        const theme = createTheme({
            nativeTheme: { themeSource: 'system' },
            windows: () => [one.window],
            background: '#131316',
            overlay: OVERLAY,
            platform: 'linux'
        });

        theme.apply({ ...LIGHT, overlay: { color: '#f4efe6', symbolColor: '#2b2118' } });
        theme.apply(LIGHT);
        expect(one.calls.at(-2)).toEqual(['overlay', { height: 48, color: '#ffffff', symbolColor: '#18181b' }]);
        expect(theme.windowOptions().titleBarOverlay).toEqual({ height: 48, color: '#ffffff', symbolColor: '#18181b' });
    });

    test('only the two colors of a page are taken, and none without an overlay or on macOS', () => {
        const one = fakeWindow();

        const theme = createTheme({
            nativeTheme: { themeSource: 'system' },
            windows: () => [one.window],
            background: '#131316',
            overlay: OVERLAY,
            platform: 'linux'
        });

        const overlay = { color: '#f4efe6', symbolColor: '#2b2118', height: 400 };
        theme.apply({ ...LIGHT, overlay });
        expect(one.calls[0]).toEqual(['overlay', { height: 48, color: '#f4efe6', symbolColor: '#2b2118' }]);

        const bare = fakeWindow();
        const without = createTheme({ nativeTheme: { themeSource: 'system' }, windows: () => [bare.window], background: '#131316', platform: 'linux' });
        without.apply({ ...LIGHT, overlay });
        expect(bare.calls).toEqual([['background', '#fafafa']]);
        expect(without.windowOptions()).toEqual({ titleBarStyle: 'hidden', backgroundColor: '#fafafa' });

        const mac = fakeWindow();

        const darwin = createTheme({
            nativeTheme: { themeSource: 'system' },
            windows: () => [mac.window],
            background: '#131316',
            overlay: OVERLAY,
            platform: 'darwin'
        });

        darwin.apply({ ...LIGHT, overlay });
        expect(mac.calls).toEqual([['background', '#fafafa']]);
        expect(darwin.windowOptions()).toEqual({ titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 17, y: 17 }, backgroundColor: '#fafafa' });
    });

    test('on macOS the traffic lights sit inset, and elsewhere without an overlay the page has the whole window', () => {
        const mac = createTheme({
            nativeTheme: { themeSource: 'system' },
            windows: () => [],
            background: '#131316',
            trafficLights: { x: 20, y: 18 },
            platform: 'darwin'
        });

        expect(mac.windowOptions()).toEqual({ titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 20, y: 18 }, backgroundColor: '#131316' });
        const linux = createTheme({ nativeTheme: { themeSource: 'system' }, windows: () => [], background: '#131316', platform: 'linux' });
        expect(linux.windowOptions()).toEqual({ titleBarStyle: 'hidden', backgroundColor: '#131316' });
    });

    test('leaves a native frame its own title bar and asks it for no overlay', () => {
        const one = fakeWindow();
        const theme = createTheme({
            nativeTheme: { themeSource: 'system' },
            windows: () => [one.window],
            background: '#131316',
            overlay: OVERLAY,
            nativeFrame: true,
            platform: 'win32'
        });

        expect(theme.windowOptions()).toEqual({ backgroundColor: '#131316' });
        theme.apply(LIGHT);
        expect(one.calls).toEqual([['background', '#fafafa']]);
    });
});

describe('the room for the window controls', () => {
    const controlsWindow = () => {
        const listeners = new Map<string, () => void>();
        let fullscreen = false;

        const window = {
            isFullScreen: () => fullscreen,
            isDestroyed: () => false,
            on: (event: string, listener: () => void) => void listeners.set(event, listener),
            off: (event: string) => void listeners.delete(event)
        } as unknown as ControlsWindow;

        const go = (next: boolean) => {
            fullscreen = next;
            listeners.get(next ? 'enter-full-screen' : 'leave-full-screen')?.();
        };

        return { window, go, listeners };
    };

    const themeOn = (platform: NodeJS.Platform, trafficLights?: { x: number; y: number }) =>
        createTheme({ nativeTheme: { themeSource: 'system' }, windows: () => [], background: '#131316', platform, trafficLights });

    test('runs as far past the traffic lights as they sit from the edge, and is gone off macOS', () => {
        const { window } = controlsWindow();
        expect(themeOn('darwin').windowControls(window)).toEqual({ inset: 86 });
        expect(themeOn('darwin', { x: 20, y: 18 }).windowControls(window)).toEqual({ inset: 92 });
        expect(themeOn('win32').windowControls(window)).toEqual({ inset: null });
    });

    test('goes away in fullscreen and comes back after it, until the app stops following', () => {
        const { window, go, listeners } = controlsWindow();
        const sent: unknown[] = [];
        const stop = themeOn('darwin').followWindowControls(window, (state) => sent.push(state));

        go(true);
        go(false);
        expect(sent).toEqual([{ inset: null }, { inset: 86 }]);

        stop();
        expect(listeners.size).toBe(0);
    });
});
