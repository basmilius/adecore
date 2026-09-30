import { describe, expect, test } from 'bun:test';
import type { BrowserWindow } from 'electron';
import { createTheme } from './theme.ts';

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
});
