import { describe, expect, test } from 'bun:test';
import { mountEditor } from './testing.ts';
import { clampFontSize, fontSizeRange, WheelZoom, zoomedFont } from './zoom.ts';

describe('the zoom range', () => {
    test('never goes below 12 pixels and keeps whole pixels', () => {
        expect(fontSizeRange({ min: 8, max: 20.4 })).toEqual({ min: 12, max: 20 });
        expect(fontSizeRange(undefined)).toEqual({ min: 12, max: 90 });
        expect(clampFontSize(11, fontSizeRange(undefined))).toBe(12);
        expect(clampFontSize(15.6, fontSizeRange(undefined))).toBe(16);
    });

    test('grows the line with the text, in whole pixels', () => {
        expect(zoomedFont({ family: 'mono', size: 13, lineHeight: 20 }, 16)).toEqual({ family: 'mono', size: 16, lineHeight: 25 });
    });
});

describe('the wheel', () => {
    test('takes a mouse notch as one step and gathers the small steps of a trackpad or a pinch', () => {
        const wheel = new WheelZoom();

        expect(wheel.step({ deltaY: -100, deltaMode: 0 })).toBe(1);
        expect(wheel.step({ deltaY: 3, deltaMode: 1 })).toBe(-1);
        expect(wheel.step({ deltaY: 8, deltaMode: 0 })).toBe(0);
        expect(wheel.step({ deltaY: 8, deltaMode: 0 })).toBe(0);
        expect(wheel.step({ deltaY: 8, deltaMode: 0 })).toBe(-1);
        expect(wheel.step({ deltaY: 8, deltaMode: 0 })).toBe(0);
        expect(wheel.step({ deltaY: -8, deltaMode: 0 })).toBe(0);
        expect(wheel.step({ deltaY: -15, deltaMode: 0 })).toBe(1);
    });
});

describe('zooming an editor', () => {
    const wheel = (mounted: ReturnType<typeof mountEditor>, init: { deltaY: number; ctrlKey?: boolean; metaKey?: boolean }): Event => {
        const event = new (mounted.page.window as unknown as { Event: typeof Event }).Event('wheel', { bubbles: true, cancelable: true });
        Object.assign(event, { deltaMode: 0, ctrlKey: false, metaKey: false, ...init });
        mounted.viewport.dispatchEvent(event);

        return event;
    };

    test('steps a pixel at a time through the commands, tells the host and resets to the page size', () => {
        const mounted = mountEditor();
        const { editor, page } = mounted;
        const sizes: (number | null)[] = [];
        editor.onFontSizeChange!((size) => sizes.push(size));
        const base = editor.getFontSize!();

        expect(editor.runCommand('increaseFontSize')).toBe(true);
        expect(editor.runCommand('increaseFontSize')).toBe(true);

        const root = page.host.querySelector('.se-editor') as HTMLElement;

        expect(editor.getFontSize!()).toBe(base + 2);
        expect(root.style.getPropertyValue('--code-font-size')).toBe(`${base + 2}px`);

        editor.runCommand('resetFontSize');

        expect(editor.getFontSize!()).toBe(base);
        expect(root.style.getPropertyValue('--code-font-size')).toBe('');
        expect(sizes).toEqual([base + 1, base + 2, null]);
    });

    test('stops at the edges of the range and is not told of a step that changed nothing', () => {
        const { editor } = mountEditor({ fontSize: 13, zoom: { min: 12, max: 14 } });
        const sizes: (number | null)[] = [];
        editor.onFontSizeChange!((size) => sizes.push(size));

        for (let i = 0; i < 4; i++) {
            editor.runCommand('decreaseFontSize');
        }

        expect(editor.getFontSize!()).toBe(12);

        editor.setFontSize!(40);

        expect(editor.getFontSize!()).toBe(14);
        expect(sizes).toEqual([12]);
    });

    test('zooms with the modifier and the wheel, and scrolls without it or when the host turned it off', () => {
        const mounted = mountEditor({ fontSize: 16 }, { apple: true });

        expect(wheel(mounted, { deltaY: -100, metaKey: true }).defaultPrevented).toBe(true);
        expect(mounted.editor.getFontSize!()).toBe(17);
        expect(wheel(mounted, { deltaY: 100, ctrlKey: true }).defaultPrevented).toBe(true);
        expect(mounted.editor.getFontSize!()).toBe(16);
        expect(wheel(mounted, { deltaY: -100 }).defaultPrevented).toBe(false);
        expect(mounted.editor.getFontSize!()).toBe(16);

        const off = mountEditor({ fontSize: 16, zoom: { wheel: false } });

        expect(wheel(off, { deltaY: -100, ctrlKey: true }).defaultPrevented).toBe(false);
        expect(off.editor.getFontSize!()).toBe(16);
    });
});
