import { useLayoutEffect, useState, type ReactElement } from 'react';
import { overflows, pageToward, scrollAfterDrag, thumbOf, type ScrollMetrics } from './scrollbar-geometry.ts';

export type ScrollAreaAxis = 'y' | 'x' | 'both';

export interface OverlayScrollbarsOptions {
    /* The directions that get a bar. */
    axis?: ScrollAreaAxis;
}

/* How long the bars stay after the last scroll, or after the pointer left a bar. */
export const SCROLLBAR_LINGER_MS = 600;

/* The theme hides the native bar of a scroller that carries this attribute. */
const OVERLAY_ATTRIBUTE = 'data-overlay-scrollbars';

/*
 * Set on the scroller for each axis of a bar that has something to scroll. A `ScrollArea` scrolls
 * only along those: Chromium composites every box that can scroll, so a canvas full of idle areas
 * would cost a layer each on every frame.
 */
const OVERFLOW_X_ATTRIBUTE = 'data-overflow-x';
const OVERFLOW_Y_ATTRIBUTE = 'data-overflow-y';

interface Bar {
    readonly element: HTMLElement;
    readonly thumb: HTMLElement;
    readonly vertical: boolean;
}

function overflowAttributeOf(bar: Bar): string {
    return bar.vertical ? OVERFLOW_Y_ATTRIBUTE : OVERFLOW_X_ATTRIBUTE;
}

/*
 * Draws thin bars over `viewport`, a scroller that stays native, so wheel, keys, `scrollIntoView` and
 * a virtualizer keep working on it. Put the returned element in a positioned ancestor whose box is
 * the viewport's: the bars lie along its right and bottom edges.
 */
export function useOverlayScrollbars(viewport: HTMLElement | null, { axis = 'y' }: OverlayScrollbarsOptions = {}): ReactElement {
    const [vertical, setVertical] = useState<HTMLDivElement | null>(null);
    const [horizontal, setHorizontal] = useState<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
        if (viewport === null) {
            return;
        }

        const bars: Bar[] = [vertical, horizontal]
            .filter((element) => element !== null)
            .map((element) => ({ element, thumb: element.firstElementChild as HTMLElement, vertical: element === vertical }));

        let overBar = false;
        let dragging = false;
        let lingering = false;
        let lingerTimer = 0;

        const metricsOf = (bar: Bar): ScrollMetrics =>
            bar.vertical
                ? { track: bar.element.clientHeight, view: viewport.clientHeight, content: viewport.scrollHeight }
                : { track: bar.element.clientWidth, view: viewport.clientWidth, content: viewport.scrollWidth };

        const positionOf = (bar: Bar): number => (bar.vertical ? viewport.scrollTop : viewport.scrollLeft);

        const show = (): void => {
            const visible = overBar || dragging || lingering;

            for (const bar of bars) {
                bar.element.toggleAttribute('data-visible', visible);
            }
        };

        const layout = (): void => {
            const overflowing = bars.map((bar) =>
                bar.vertical ? overflows(viewport.clientHeight, viewport.scrollHeight) : overflows(viewport.clientWidth, viewport.scrollWidth)
            );

            const corner = overflowing.length === 2 && overflowing.every(Boolean);

            bars.forEach((bar, index) => {
                bar.element.toggleAttribute('data-overflow', overflowing[index]);
                bar.element.toggleAttribute('data-corner', corner);
                viewport.toggleAttribute(overflowAttributeOf(bar), overflowing[index]);
            });

            bars.forEach((bar, index) => {
                if (!overflowing[index]) {
                    return;
                }

                const { size, offset } = thumbOf(metricsOf(bar), positionOf(bar));

                if (bar.vertical) {
                    bar.thumb.style.height = `${size}px`;
                    bar.thumb.style.translate = `0 ${offset}px`;
                } else {
                    bar.thumb.style.width = `${size}px`;
                    bar.thumb.style.translate = `${offset}px 0`;
                }
            });
        };

        const linger = (): void => {
            lingering = true;
            window.clearTimeout(lingerTimer);

            lingerTimer = window.setTimeout(() => {
                lingering = false;
                show();
            }, SCROLLBAR_LINGER_MS);

            show();
        };

        const onScroll = (): void => {
            layout();
            linger();
        };

        // Only a scroll brings the bars; a bar the pointer reached while they showed keeps them, since a hidden one takes no pointer.
        const onBarEnter = (event: PointerEvent): void => {
            if (event.pointerType !== 'touch') {
                overBar = true;
                show();
            }
        };

        const onBarLeave = (): void => {
            if (overBar) {
                overBar = false;
                linger();
            }
        };

        const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

        const pressHandlers = bars.map((bar) => {
            const onThumbDown = (event: PointerEvent): void => {
                if (event.button !== 0) {
                    return;
                }

                // The press belongs to the thumb: no text selection, no page from the track under it.
                event.preventDefault();
                event.stopPropagation();
                bar.thumb.setPointerCapture(event.pointerId);

                const metrics = metricsOf(bar);
                const from = bar.vertical ? event.clientY : event.clientX;
                const start = positionOf(bar);
                dragging = true;
                bar.element.setAttribute('data-dragging', '');
                viewport.setAttribute('data-scrollbar-dragging', '');
                show();

                const onMove = (move: PointerEvent): void => {
                    const next = scrollAfterDrag(metrics, start, (bar.vertical ? move.clientY : move.clientX) - from);

                    if (bar.vertical) {
                        viewport.scrollTop = next;
                    } else {
                        viewport.scrollLeft = next;
                    }
                };

                const onEnd = (): void => {
                    bar.thumb.removeEventListener('pointermove', onMove);
                    bar.thumb.removeEventListener('pointerup', onEnd);
                    bar.thumb.removeEventListener('pointercancel', onEnd);
                    bar.thumb.removeEventListener('lostpointercapture', onEnd);
                    dragging = false;
                    bar.element.removeAttribute('data-dragging');
                    viewport.removeAttribute('data-scrollbar-dragging');
                    linger();
                };

                bar.thumb.addEventListener('pointermove', onMove);
                bar.thumb.addEventListener('pointerup', onEnd);
                bar.thumb.addEventListener('pointercancel', onEnd);
                bar.thumb.addEventListener('lostpointercapture', onEnd);
            };

            // WebKit on iOS starts a text selection on a long press whatever the pointer events do; only the touch itself can be refused.
            const onThumbTouch = (event: TouchEvent): void => {
                event.preventDefault();
            };

            const onTrackDown = (event: PointerEvent): void => {
                if (event.button !== 0) {
                    return;
                }

                event.preventDefault();
                const thumb = bar.thumb.getBoundingClientRect();

                const delta = bar.vertical
                    ? pageToward(event.clientY, thumb.top, thumb.bottom, viewport.clientHeight)
                    : pageToward(event.clientX, thumb.left, thumb.right, viewport.clientWidth);

                if (delta === 0) {
                    return;
                }

                const behavior = reducedMotion() ? 'instant' : 'smooth';
                viewport.scrollBy(bar.vertical ? { top: delta, behavior } : { left: delta, behavior });
            };

            bar.thumb.addEventListener('pointerdown', onThumbDown);
            bar.thumb.addEventListener('touchstart', onThumbTouch, { passive: false });
            bar.element.addEventListener('pointerdown', onTrackDown);
            bar.element.addEventListener('pointerenter', onBarEnter);
            bar.element.addEventListener('pointerleave', onBarLeave);

            return () => {
                bar.thumb.removeEventListener('pointerdown', onThumbDown);
                bar.thumb.removeEventListener('touchstart', onThumbTouch);
                bar.element.removeEventListener('pointerdown', onTrackDown);
                bar.element.removeEventListener('pointerenter', onBarEnter);
                bar.element.removeEventListener('pointerleave', onBarLeave);
            };
        });

        // A document without layout, such as a test's, has no observers; the bars then follow the scroll alone.
        const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(layout);
        sizes?.observe(viewport);

        // A row added to the content changes what scrolls without resizing the rows already observed.
        const content =
            typeof MutationObserver === 'undefined'
                ? null
                : new MutationObserver(() => {
                      observeContent();
                      layout();
                  });

        // Text right in the scroller, as in a `<pre>`, grows without resizing anything an observer sees.
        const observeContent = (): void => {
            for (const child of viewport.childNodes) {
                if (child instanceof Element) {
                    sizes?.observe(child);
                } else if (child.nodeType === Node.TEXT_NODE) {
                    content?.observe(child, { characterData: true });
                }
            }
        };

        content?.observe(viewport, { childList: true });
        observeContent();
        viewport.setAttribute(OVERLAY_ATTRIBUTE, '');
        viewport.addEventListener('scroll', onScroll, { passive: true });
        layout();

        return () => {
            for (const release of pressHandlers) {
                release();
            }

            sizes?.disconnect();
            content?.disconnect();
            window.clearTimeout(lingerTimer);
            viewport.removeAttribute(OVERLAY_ATTRIBUTE);
            viewport.removeAttribute(OVERFLOW_X_ATTRIBUTE);
            viewport.removeAttribute(OVERFLOW_Y_ATTRIBUTE);
            viewport.removeAttribute('data-scrollbar-dragging');
            viewport.removeEventListener('scroll', onScroll);
        };
    }, [viewport, vertical, horizontal]);

    return (
        <>
            {axis !== 'x' && (
                <div ref={setVertical} aria-hidden className="ade-scrollbar" data-orientation="vertical">
                    <div className="ade-scrollbar-thumb" />
                </div>
            )}
            {axis !== 'y' && (
                <div ref={setHorizontal} aria-hidden className="ade-scrollbar" data-orientation="horizontal">
                    <div className="ade-scrollbar-thumb" />
                </div>
            )}
        </>
    );
}
