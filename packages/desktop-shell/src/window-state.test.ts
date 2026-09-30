import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'bun:test';
import type { Rectangle } from 'electron';
import { createWindowState, fileStorage, fitBounds, type StateWindow, type WindowStateStorage } from './window-state.ts';

const DEFAULTS = { width: 1440, height: 900 };
const LAPTOP = { workArea: { x: 0, y: 25, width: 1512, height: 944 } };
const MONITOR = { workArea: { x: 1512, y: 0, width: 2560, height: 1415 } };

describe('fitBounds', () => {
    test('without saved bounds a window opens at its default size, which Electron centers', () => {
        expect(fitBounds(null, [LAPTOP], DEFAULTS)).toEqual({ width: 1440, height: 900 });
    });

    test('saved bounds on a display that is there stand as they were', () => {
        const saved = { x: 1800, y: 120, width: 1600, height: 1000 };
        expect(fitBounds(saved, [LAPTOP, MONITOR], DEFAULTS)).toEqual(saved);
    });

    test('bounds on a display that was unplugged open at the default size', () => {
        expect(fitBounds({ x: 1800, y: 120, width: 1600, height: 1000 }, [LAPTOP], DEFAULTS)).toEqual({ width: 1440, height: 900 });
    });

    test('a window with only a sliver left on a display is not reachable', () => {
        expect(fitBounds({ x: 1480, y: 100, width: 800, height: 600 }, [LAPTOP], DEFAULTS)).toEqual({ width: 1440, height: 900 });
    });

    test('a window partly off its display is moved back onto it', () => {
        expect(fitBounds({ x: 1000, y: 500, width: 800, height: 600 }, [LAPTOP], DEFAULTS)).toEqual({ x: 712, y: 369, width: 800, height: 600 });
    });

    test('a window larger than its display, as after a change of resolution, shrinks to the work area', () => {
        expect(fitBounds({ x: 0, y: 25, width: 2560, height: 1415 }, [LAPTOP], DEFAULTS)).toEqual({ x: 0, y: 25, width: 1512, height: 944 });
    });
});

const memoryStorage = (text: string | null = null) => {
    const written: string[] = [];
    const storage: WindowStateStorage = { read: () => text, write: (next) => void written.push(next) };
    return { storage, written, last: () => JSON.parse(written.at(-1)!) as { version: number; windows: Record<string, unknown> } };
};

const fakeTimers = () => {
    let pending: (() => void) | null = null;
    return {
        setTimeout: (run: () => void) => {
            pending = run;
            return run;
        },
        clearTimeout: () => {
            pending = null;
        },
        fire: () => {
            const run = pending;
            pending = null;
            run?.();
        },
        pending: () => pending !== null
    };
};

const fakeWindow = (bounds: Rectangle) => {
    const listeners = new Map<string, (() => void)[]>();
    const state = { bounds, maximized: false, fullScreen: false, destroyed: false };
    const add = (event: string, listener: () => void) => listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    const window = {
        getNormalBounds: () => state.bounds,
        isMaximized: () => state.maximized,
        isFullScreen: () => state.fullScreen,
        isDestroyed: () => state.destroyed,
        maximize: () => {
            state.maximized = true;
        },
        setFullScreen: (flag: boolean) => {
            state.fullScreen = flag;
        },
        on: add,
        once: add
    };
    const emit = (event: string): void => {
        for (const listener of listeners.get(event) ?? []) {
            listener();
        }
    };
    return { window: window as unknown as StateWindow, state, emit };
};

const setup = (text: string | null = null) => {
    const memory = memoryStorage(text);
    const timers = fakeTimers();
    const windowState = createWindowState({ storage: memory.storage, displays: () => [LAPTOP, MONITOR], defaults: DEFAULTS, ...timers });
    return { windowState, timers, ...memory };
};

const saved = (windows: Record<string, unknown>): string => JSON.stringify({ version: 1, windows });

describe('createWindowState', () => {
    test('opens a window where it stood', () => {
        const { windowState } = setup(saved({ main: { x: 1800, y: 120, width: 1600, height: 1000, maximized: false, fullScreen: false } }));
        expect(windowState.bounds('main')).toEqual({ x: 1800, y: 120, width: 1600, height: 1000 });
        expect(windowState.bounds('other')).toEqual(DEFAULTS);
    });

    test('writes a moved window once it stands still', () => {
        const { windowState, timers, written, last } = setup();
        const { window, state, emit } = fakeWindow({ x: 10, y: 40, width: 1200, height: 800 });
        windowState.track('main', window);
        emit('move');
        state.bounds = { x: 20, y: 40, width: 1200, height: 800 };
        emit('move');
        expect(written).toEqual([]);
        timers.fire();
        expect(last()).toEqual({ version: 1, windows: { main: { x: 20, y: 40, width: 1200, height: 800, maximized: false, fullScreen: false } } });
    });

    test('keeps the normal bounds with the flag while maximized or in full screen', () => {
        const { windowState, timers, last } = setup();
        const { window, state, emit } = fakeWindow({ x: 10, y: 40, width: 1200, height: 800 });
        windowState.track('main', window);
        state.maximized = true;
        emit('maximize');
        timers.fire();
        expect(last().windows.main).toEqual({ x: 10, y: 40, width: 1200, height: 800, maximized: true, fullScreen: false });
        state.maximized = false;
        state.fullScreen = true;
        emit('enter-full-screen');
        timers.fire();
        expect(last().windows.main).toEqual({ x: 10, y: 40, width: 1200, height: 800, maximized: false, fullScreen: true });
    });

    test('maximizes or goes full screen again once the window is ready to show', () => {
        const { windowState } = setup(
            saved({
                wide: { x: 0, y: 25, width: 1200, height: 800, maximized: true, fullScreen: false },
                full: { x: 0, y: 25, width: 1200, height: 800, maximized: true, fullScreen: true }
            })
        );
        const wide = fakeWindow({ x: 0, y: 25, width: 1200, height: 800 });
        const full = fakeWindow({ x: 0, y: 25, width: 1200, height: 800 });
        windowState.track('wide', wide.window);
        windowState.track('full', full.window);
        expect(wide.state.maximized).toBe(false);
        wide.emit('ready-to-show');
        full.emit('ready-to-show');
        expect(wide.state).toMatchObject({ maximized: true, fullScreen: false });
        expect(full.state).toMatchObject({ maximized: false, fullScreen: true });
    });

    test('writes at once when a window closes, and nothing after', () => {
        const { windowState, timers, written } = setup();
        const { window, state, emit } = fakeWindow({ x: 10, y: 40, width: 1200, height: 800 });
        windowState.track('main', window);
        emit('resize');
        emit('close');
        expect(written).toHaveLength(1);
        expect(timers.pending()).toBe(false);
        state.destroyed = true;
        emit('move');
        expect(timers.pending()).toBe(false);
    });

    test('flush writes only what is pending', () => {
        const { windowState, written } = setup();
        windowState.flush();
        expect(written).toEqual([]);
        const { window, emit } = fakeWindow({ x: 10, y: 40, width: 1200, height: 800 });
        windowState.track('main', window);
        emit('resize');
        windowState.flush();
        expect(written).toHaveLength(1);
    });

    test('keeps the windows it did not see this time', () => {
        const { windowState, timers, last } = setup(saved({ other: { x: 1800, y: 120, width: 1600, height: 1000, maximized: false, fullScreen: false } }));
        const { window, emit } = fakeWindow({ x: 10, y: 40, width: 1200, height: 800 });
        windowState.track('main', window);
        emit('resize');
        timers.fire();
        expect(Object.keys(last().windows)).toEqual(['other', 'main']);
    });

    test('a file that does not parse, of another version or with a broken entry is read as far as it holds', () => {
        expect(setup('{').windowState.bounds('main')).toEqual(DEFAULTS);
        expect(setup(JSON.stringify({ version: 2, windows: { main: { x: 0, y: 25, width: 800, height: 600 } } })).windowState.bounds('main')).toEqual(DEFAULTS);
        const { windowState } = setup(
            saved({
                broken: { x: 0, y: 25, width: 0, height: 600 },
                half: { x: 0.5, y: 25, width: 800, height: 600 },
                main: { x: 0, y: 25, width: 800, height: 600 }
            })
        );
        expect(windowState.bounds('broken')).toEqual(DEFAULTS);
        expect(windowState.bounds('half')).toEqual(DEFAULTS);
        expect(windowState.bounds('main')).toEqual({ x: 0, y: 25, width: 800, height: 600 });
    });
});

describe('fileStorage', () => {
    const folder = mkdtempSync(join(tmpdir(), 'window-state-'));
    afterAll(() => rmSync(folder, { recursive: true, force: true }));

    test('reads nothing before the first write and the last write after it', () => {
        const storage = fileStorage(join(folder, 'window-state.json'));
        expect(storage.read()).toBeNull();
        storage.write('one');
        storage.write('two');
        expect(storage.read()).toBe('two');
        expect(readFileSync(join(folder, 'window-state.json'), 'utf8')).toBe('two');
    });
});
