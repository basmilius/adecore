import type { VisualScrollRequest } from '@adecore/agent-contracts/visual';
import { visualViewportGeometry } from './logic/visual-viewport';
import type { VisualBridge } from './visual-bridge';

/* Keeps one small frame in a full-height timeline row, without rendering React on scroll. */
export class VisualViewportController {
    private readonly box: HTMLElement;
    private readonly viewport: HTMLElement;
    private readonly scroller: HTMLElement;
    private readonly bridge: VisualBridge;
    private readonly observer: ResizeObserver;
    private readonly attributes: MutationObserver;
    private readonly view: Window;
    private frame = 0;
    private disposed = false;
    private last = '';
    private pendingDelta = 0;
    private readonly onScroll: () => void;

    constructor(box: HTMLElement, viewport: HTMLElement, scroller: HTMLElement, bridge: VisualBridge) {
        this.box = box;
        this.viewport = viewport;
        this.scroller = scroller;
        this.bridge = bridge;
        this.view = box.ownerDocument.defaultView!;
        this.onScroll = () => this.refresh();
        this.observer = new ResizeObserver(this.onScroll);
        this.observer.observe(box);
        this.observer.observe(scroller);
        this.attributes = new MutationObserver(this.onScroll);
        const row = box.closest('[data-index]');
        if (row) {
            this.attributes.observe(row, { attributes: true, attributeFilter: ['style'] });
        }
        scroller.addEventListener('scroll', this.onScroll, { passive: true });
        this.refresh();
    }

    refresh(): void {
        if (this.disposed) {
            return;
        }
        const top = this.offsetInScroller(this.scroller.getBoundingClientRect(), this.box.getBoundingClientRect());
        const available = this.scroller.clientHeight;
        const geometry = visualViewportGeometry(this.box.offsetHeight, available, top);
        this.viewport.style.height = `${geometry.height}px`;
        const key = `${geometry.top}:${geometry.height}`;
        if (key !== this.last) {
            this.last = key;
            this.bridge.setViewport(geometry);
        }
    }

    scroll(request: VisualScrollRequest): void {
        const outer = this.scroller.getBoundingClientRect();
        const box = this.box.getBoundingClientRect();
        if (this.disposed || box.bottom <= outer.top || box.top >= outer.bottom) {
            return;
        }
        if ('by' in request) {
            this.pendingDelta += request.by;
            this.schedule();
            return;
        }
        this.pendingDelta = 0;
        const start = this.scroller.scrollTop + this.offsetInScroller(outer, box);
        const top = 'to' in request ? start + request.to : request.edge === 'start' ? 0 : this.scroller.scrollHeight;
        this.scroller.scrollTo({ top, behavior: 'instant' });
        this.refresh();
    }

    dispose(): void {
        this.disposed = true;
        this.view.cancelAnimationFrame(this.frame);
        this.observer.disconnect();
        this.attributes.disconnect();
        this.scroller.removeEventListener('scroll', this.onScroll);
        this.bridge.setViewport(null);
    }

    /* The box's top below the scroller's visible top, in the scroller's own pixels. */
    private offsetInScroller(outer: DOMRect, box: DOMRect): number {
        // A chat on a canvas can be scaled; messages inside its frame use unscaled CSS pixels.
        const scale = outer.height / this.scroller.offsetHeight || 1;
        return (box.top - outer.top) / scale - this.scroller.clientTop;
    }

    private schedule(): void {
        if (this.frame || this.disposed) {
            return;
        }
        this.frame = this.view.requestAnimationFrame(() => {
            this.frame = 0;
            if (this.pendingDelta !== 0) {
                this.scroller.scrollBy({ top: this.pendingDelta, behavior: 'instant' });
                this.pendingDelta = 0;
            }
            this.refresh();
        });
    }
}
