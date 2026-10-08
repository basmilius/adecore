import { describe, expect, test } from 'bun:test';
import { createElement, type PointerEvent as ReactPointerEvent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useColumnResize, type ColumnEdge, type ColumnResize } from './useColumnResize.ts';

class Handle extends EventTarget {
    captured = false;
    setPointerCapture(): void {
        this.captured = true;
    }
    hasPointerCapture(): boolean {
        return this.captured;
    }
    releasePointerCapture(): void {
        this.captured = false;
    }
}

function setup(from: ColumnEdge) {
    const handle = new Handle();
    const sizes: number[] = [];
    const attributes = new Map<string, string>();
    const column = {
        getBoundingClientRect: () => ({ width: 388, height: 388 }),
        setAttribute: (key: string, value: string) => attributes.set(key, value),
        removeAttribute: (key: string) => attributes.delete(key)
    } as unknown as HTMLElement;
    const rendered: ColumnResize[] = [];
    function Probe() {
        const resize = useColumnResize(
            { current: column },
            {
                size: 0,
                min: 328,
                max: () => 808,
                from,
                onSize: (size) => sizes.push(size)
            }
        );
        rendered.push(resize);
        return null;
    }
    renderToStaticMarkup(createElement(Probe));
    const { startResize } = rendered[0]!;
    startResize({ currentTarget: handle, clientX: 104, clientY: 104, pointerId: 1, preventDefault() {} } as unknown as ReactPointerEvent<HTMLElement>);
    function move(position: number): void {
        handle.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: position, clientY: position }));
    }
    return { handle, sizes, attributes, move };
}

describe('resizing a column', () => {
    test.each(['left', 'right', 'top', 'bottom'] as const)('preserves the grab offset on the %s edge', (from) => {
        const { move, sizes } = setup(from);
        move(104);
        move(124);
        expect(sizes).toEqual([388, from === 'right' || from === 'bottom' ? 368 : 408]);
    });

    test('clamps the rendered size, including a gap, at both bounds', () => {
        const { move, sizes } = setup('right');
        move(900);
        move(-900);
        expect(sizes).toEqual([328, 808]);
    });

    test.each(['pointerup', 'pointercancel', 'lostpointercapture'])('%s releases the handle and stops changing the size', (type) => {
        const { handle, attributes, move, sizes } = setup('right');
        expect(attributes.has('data-resizing')).toBe(true);
        move(124);
        handle.dispatchEvent(new Event(type));
        move(144);
        expect(sizes).toEqual([368]);
        expect(handle.captured).toBe(false);
        expect(attributes.has('data-resizing')).toBe(false);
    });
});
