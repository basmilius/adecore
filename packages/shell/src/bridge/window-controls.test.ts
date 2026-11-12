import { describe, expect, test } from 'bun:test';
import { windowControlsOf } from './window-controls.ts';

describe('the room for the window controls from the platform alone', () => {
    test('clears the traffic lights on macOS, where they sit inside the page', () => {
        expect(windowControlsOf('darwin')).toEqual({ inset: 86 });
        expect(windowControlsOf('darwin', { trafficLights: { x: 20, y: 18 } })).toEqual({ inset: 92 });
    });

    test('keeps none in fullscreen or where the controls sit elsewhere', () => {
        expect(windowControlsOf('darwin', { fullscreen: true })).toEqual({ inset: null });
        expect(windowControlsOf('win32')).toEqual({ inset: null });
        expect(windowControlsOf('linux')).toEqual({ inset: null });
    });
});
