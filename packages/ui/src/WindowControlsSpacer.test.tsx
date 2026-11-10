import { afterEach, describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { setWindowControlsSource, type WindowControlsSource } from './window-controls.ts';
import { WindowControlsSpacer } from './WindowControlsSpacer.tsx';

const sourceOf = (inset: number | null): WindowControlsSource => ({ inset: () => inset, subscribe: () => () => {} });

describe('a window controls spacer', () => {
    let previous: WindowControlsSource | undefined;

    afterEach(() => {
        if (previous !== undefined) {
            setWindowControlsSource(previous);
        }
    });

    test('draws nothing until the app says the window has controls to clear', () => {
        expect(renderToStaticMarkup(<WindowControlsSpacer />)).toBe('');
    });

    test('is as wide as the room the app reports, and nothing again once that room is gone', () => {
        previous = setWindowControlsSource(sourceOf(86));
        expect(renderToStaticMarkup(<WindowControlsSpacer />)).toContain('width:86px');

        setWindowControlsSource(sourceOf(null));
        expect(renderToStaticMarkup(<WindowControlsSpacer />)).toBe('');
    });
});
