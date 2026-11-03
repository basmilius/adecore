import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScrollArea } from './ScrollArea.tsx';
import { SCROLLBAR_LINGER_MS } from './useOverlayScrollbars.tsx';

describe('a scroll area', () => {
    test('hands its content and props to the viewport and hides its bars from assistive tech', () => {
        const markup = renderToStaticMarkup(
            <ScrollArea axis="both" className="h-40" viewportClassName="p-2" role="listbox" tabIndex={0}>
                <p>Rows</p>
            </ScrollArea>
        );

        expect(markup).toContain('class="ade-scroll-area h-40"');
        expect(markup).toMatch(/<div role="listbox" tabindex="0" data-axis="both" class="ade-scroll-viewport p-2"><p>Rows<\/p><\/div>/);
        expect(markup.match(/aria-hidden="true" class="ade-scrollbar"/g)).toHaveLength(2);
    });

    test('scrolls the element it is told to render, such as a pre', () => {
        const markup = renderToStaticMarkup(
            <ScrollArea render={<pre />} viewportClassName="p-2">
                text
            </ScrollArea>
        );

        expect(markup).toContain('<pre data-axis="y" class="ade-scroll-viewport p-2">text</pre>');
    });

    test('draws only the bar of the axis it scrolls in', () => {
        expect(renderToStaticMarkup(<ScrollArea />)).toContain('data-orientation="vertical"');
        expect(renderToStaticMarkup(<ScrollArea />)).not.toContain('data-orientation="horizontal"');
        expect(renderToStaticMarkup(<ScrollArea axis="x" />)).not.toContain('data-orientation="vertical"');
    });
});

interface Box {
    clientWidth: number;
    clientHeight: number;
    scrollWidth: number;
    scrollHeight: number;
}

const sized = (element: Element, box: Partial<Box>): void => {
    for (const [key, value] of Object.entries(box)) {
        Object.defineProperty(element, key, { configurable: true, value });
    }
};

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/ui/src/ScrollArea.test.tsx`.
describe.skipIf(typeof document === 'undefined')('a scroll area in a window', () => {
    let container: HTMLDivElement;
    let root: Root;

    const mount = async (axis: 'y' | 'both', box: Box) => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(<ScrollArea axis={axis}>content</ScrollArea>));

        const viewport = container.querySelector<HTMLElement>('.ade-scroll-viewport')!;
        const vertical = container.querySelector<HTMLElement>('[data-orientation=vertical]')!;
        const horizontal = container.querySelector<HTMLElement>('[data-orientation=horizontal]');
        sized(viewport, box);
        sized(vertical, { clientHeight: box.clientHeight });

        if (horizontal !== null) {
            sized(horizontal, { clientWidth: box.clientWidth });
        }

        const scrollTo = (top: number): void => {
            viewport.scrollTop = top;
            viewport.dispatchEvent(new Event('scroll'));
        };

        scrollTo(0);

        return { viewport, vertical, horizontal, thumb: vertical.firstElementChild as HTMLElement, scrollTo };
    };

    const pointer = (type: string, init: { clientX?: number; clientY?: number; pointerType?: string } = {}): Event =>
        Object.assign(new Event(type, { bubbles: type === 'pointerdown' }), { button: 0, pointerId: 1, clientX: 0, clientY: 0, pointerType: 'mouse', ...init });

    beforeEach(() => {
        jest.useFakeTimers();
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        jest.useRealTimers();
    });

    test('sizes and places the thumb by the share of the content in view', async () => {
        const { thumb, scrollTo } = await mount('y', { clientWidth: 200, clientHeight: 400, scrollWidth: 200, scrollHeight: 1600 });
        expect(thumb.style.height).toBe('100px');
        expect(thumb.style.translate).toBe('0 0px');

        scrollTo(600);
        expect(thumb.style.translate).toBe('0 150px');
    });

    test('keeps a thumb a pointer can grab over a very long content', async () => {
        const { thumb } = await mount('y', { clientWidth: 200, clientHeight: 300, scrollWidth: 200, scrollHeight: 100_000 });
        expect(thumb.style.height).toBe('24px');
    });

    test('hides the bar of an axis that does not overflow', async () => {
        const { vertical, horizontal } = await mount('both', { clientWidth: 200, clientHeight: 400, scrollWidth: 200, scrollHeight: 1600 });
        expect(vertical.hasAttribute('data-overflow')).toBe(true);
        expect(horizontal!.hasAttribute('data-overflow')).toBe(false);
        expect(vertical.hasAttribute('data-corner')).toBe(false);
    });

    test('leaves the corner free when both bars show', async () => {
        const { vertical, horizontal } = await mount('both', { clientWidth: 200, clientHeight: 400, scrollWidth: 800, scrollHeight: 1600 });
        expect(vertical.hasAttribute('data-corner')).toBe(true);
        expect(horizontal!.hasAttribute('data-corner')).toBe(true);
    });

    test('shows the bars while it scrolls and fades them a while after the last scroll', async () => {
        const { vertical, scrollTo } = await mount('y', { clientWidth: 200, clientHeight: 400, scrollWidth: 200, scrollHeight: 1600 });
        jest.advanceTimersByTime(SCROLLBAR_LINGER_MS);
        expect(vertical.hasAttribute('data-visible')).toBe(false);

        scrollTo(100);
        expect(vertical.hasAttribute('data-visible')).toBe(true);

        jest.advanceTimersByTime(SCROLLBAR_LINGER_MS - 1);
        expect(vertical.hasAttribute('data-visible')).toBe(true);

        jest.advanceTimersByTime(1);
        expect(vertical.hasAttribute('data-visible')).toBe(false);
    });

    test('shows the bars while a mouse is over the area, not for a finger resting on it', async () => {
        const { viewport, vertical } = await mount('y', { clientWidth: 200, clientHeight: 400, scrollWidth: 200, scrollHeight: 1600 });
        jest.advanceTimersByTime(SCROLLBAR_LINGER_MS);

        viewport.dispatchEvent(pointer('pointerenter', { pointerType: 'touch' }));
        expect(vertical.hasAttribute('data-visible')).toBe(false);

        viewport.dispatchEvent(pointer('pointerenter'));
        jest.advanceTimersByTime(SCROLLBAR_LINGER_MS * 2);
        expect(vertical.hasAttribute('data-visible')).toBe(true);

        viewport.dispatchEvent(pointer('pointerleave'));
        jest.advanceTimersByTime(SCROLLBAR_LINGER_MS);
        expect(vertical.hasAttribute('data-visible')).toBe(false);
    });

    test('scrolls the content along with a dragged thumb', async () => {
        const { viewport, vertical, thumb } = await mount('y', { clientWidth: 200, clientHeight: 400, scrollWidth: 200, scrollHeight: 1600 });
        const captured: number[] = [];
        thumb.setPointerCapture = (id: number) => captured.push(id);

        thumb.dispatchEvent(pointer('pointerdown', { clientY: 50 }));
        expect(captured).toEqual([1]);
        expect(vertical.hasAttribute('data-dragging')).toBe(true);
        expect(viewport.hasAttribute('data-scrollbar-dragging')).toBe(true);

        thumb.dispatchEvent(pointer('pointermove', { clientY: 200 }));
        expect(viewport.scrollTop).toBe(600);

        thumb.dispatchEvent(pointer('pointerup', { clientY: 200 }));
        expect(vertical.hasAttribute('data-dragging')).toBe(false);
        expect(viewport.hasAttribute('data-scrollbar-dragging')).toBe(false);

        thumb.dispatchEvent(pointer('pointermove', { clientY: 300 }));
        expect(viewport.scrollTop).toBe(600);
    });

    test('refuses the touch on the thumb, so a long press selects no text', async () => {
        const { thumb } = await mount('y', { clientWidth: 200, clientHeight: 400, scrollWidth: 200, scrollHeight: 1600 });
        const touch = new Event('touchstart', { bubbles: true, cancelable: true });

        thumb.dispatchEvent(touch);
        expect(touch.defaultPrevented).toBe(true);
    });

    test('pages toward a press on the track', async () => {
        const { viewport, vertical, thumb } = await mount('y', { clientWidth: 200, clientHeight: 400, scrollWidth: 200, scrollHeight: 1600 });
        const scrolls: ScrollToOptions[] = [];
        viewport.scrollBy = ((options: ScrollToOptions) => scrolls.push(options)) as typeof viewport.scrollBy;
        thumb.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 188, right: 200 }) as DOMRect;

        vertical.dispatchEvent(pointer('pointerdown', { clientY: 300 }));
        expect(scrolls).toHaveLength(1);
        expect(scrolls[0]!.top).toBe(360);
    });
});
