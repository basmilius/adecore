import {
    VISUAL_BRIDGE_METHODS,
    parseVisualMessage,
    visualHostContextMessage,
    visualOpenLinkResult,
    visualResourceReadyMessage,
    visualViewportMessage,
    type ChatVisual,
    type VisualAppearance,
    type VisualScrollRequest,
    type VisualViewport,
    type VisualTheme
} from '@adecore/agent-contracts/visual';
import { clampVisualHeight, visualContentHeight } from './logic/visual-height';

/*
 * How long a frame that finished loading may stay silent before it counts as failed. The sandbox host
 * page speaks while it loads, so silence means the address served something else; the margin is for
 * its message and the load event, which cross between processes and may arrive in either order.
 */
const SILENCE_MS = 3000;

/* The window of a visual's frame, as the bridge posts into it. */
export interface VisualFrameWindow {
    postMessage(message: unknown, targetOrigin: string): void;
}

export interface VisualBridgeOptions {
    /* The frame's window as it is now, or null; read for every message, since only that window may speak for the frame. */
    frame(): VisualFrameWindow | null;
    visual: Pick<ChatVisual, 'maxHeight'>;
    /* The page, as text. It goes to the frame every time the sandbox host page says it listens. */
    page: Promise<string>;
    /* The theme the frame's address carries. */
    theme: VisualTheme;
    /* Whether a person is acting in the frame right now, so a link the page asks to open is one they followed. */
    mayOpenLink(): boolean;
    openLink(url: string): void;
    onHeight(height: number): void;
    onViewportReady?(): void;
    onScroll?(request: VisualScrollRequest): void;
    /* The appearance the page is drawn in, from the first size it reports and after every theme it gets since. */
    onAppearance(appearance: VisualAppearance): void;
    /* The page could not be read, or the frame's address answered with something other than the sandbox host page. */
    onFailure(): void;
    /* Runs `run` after `ms`, and answers what cancels it; a test hands a clock of its own. */
    after?(ms: number, run: () => void): () => void;
}

function timeout(ms: number, run: () => void): () => void {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
}

/*
 * Talks to the frame of one visual. It hands the sandbox host page the visual's page when it says it
 * listens, keeps the page in the app's theme, follows the size the page reports and opens the links a
 * person follows in it. A message counts only when it comes from the frame's own window, and the
 * messages that come from the page count only once the page was sent.
 */
export class VisualBridge {
    private readonly options: VisualBridgeOptions;
    private theme: VisualTheme;
    private html: string | null = null;
    /* Whether the sandbox host page ever said it listens, which is what tells it from an error page. */
    private heard = false;
    /* The sandbox host page listens and has not been sent the page yet. */
    private waiting = false;
    /* The theme the page was last sent, from the moment it was sent; null before that. */
    private sent: VisualTheme | null = null;
    /* Whether the page reported a size since it was sent, which says it runs and is drawn. */
    private live = false;
    private viewportReady = false;
    private viewport: VisualViewport | null = null;
    private disposed = false;
    private cancelSilence: () => void = () => undefined;

    constructor(options: VisualBridgeOptions) {
        this.options = options;
        this.theme = options.theme;
        options.page.then(
            (html) => {
                this.html = html;
                this.sendPage();
            },
            () => {
                if (!this.disposed) {
                    options.onFailure();
                }
            }
        );
    }

    /* A `message` event of the window the frame is in. */
    receive(event: { source: unknown; data: unknown }): void {
        const frame = this.options.frame();
        if (this.disposed || frame === null || event.source !== frame) {
            return;
        }
        const message = parseVisualMessage(event.data);
        switch (message?.method) {
            case VISUAL_BRIDGE_METHODS.sandboxProxyReady:
                // A frame that loads again starts over from the sandbox host page.
                this.heard = true;
                this.waiting = true;
                this.sent = null;
                this.live = false;
                this.viewportReady = false;
                this.cancelSilence();
                this.sendPage();
                return;
            case VISUAL_BRIDGE_METHODS.sizeChanged:
                if (this.sent === null) {
                    return;
                }
                if (!this.live) {
                    this.live = true;
                    this.options.onAppearance(this.sent.appearance);
                }
                this.options.onHeight(
                    this.options.onViewportReady ? visualContentHeight(message.height) : clampVisualHeight(this.options.visual, message.height)
                );
                return;
            case VISUAL_BRIDGE_METHODS.viewportReady:
                if (this.sent === null) {
                    return;
                }
                this.viewportReady = true;
                this.options.onViewportReady?.();
                this.setViewport(this.viewport);
                return;
            case VISUAL_BRIDGE_METHODS.scrollRequest:
                if (this.sent !== null && this.viewportReady && this.viewport !== null) {
                    this.options.onScroll?.(message.request);
                }
                return;
            case VISUAL_BRIDGE_METHODS.openLink:
                if (this.sent === null) {
                    return;
                }
                if (this.options.mayOpenLink()) {
                    this.options.openLink(message.url);
                }
                frame.postMessage(visualOpenLinkResult(message.id), '*');
                return;
            default:
                return;
        }
    }

    setViewport(viewport: VisualViewport | null): void {
        this.viewport = viewport;
        if (!this.disposed && this.sent !== null && this.viewportReady) {
            this.options.frame()?.postMessage(visualViewportMessage(viewport), '*');
        }
    }

    /* The app's theme changed; a page that was sent follows it at once, without loading again. */
    setTheme(theme: VisualTheme): void {
        this.theme = theme;
        const frame = this.options.frame();
        if (this.disposed || this.sent === null || frame === null) {
            return;
        }
        this.postTheme(frame);
        if (this.live) {
            this.options.onAppearance(theme.appearance);
        }
    }

    /* The frame fired `load`. */
    loaded(): void {
        if (this.heard || this.disposed) {
            return;
        }
        this.cancelSilence();
        this.cancelSilence = (this.options.after ?? timeout)(SILENCE_MS, () => {
            if (!this.heard && !this.disposed) {
                this.options.onFailure();
            }
        });
    }

    dispose(): void {
        this.disposed = true;
        this.cancelSilence();
    }

    private sendPage(): void {
        const frame = this.options.frame();
        if (this.disposed || !this.waiting || this.html === null || frame === null) {
            return;
        }
        this.waiting = false;
        // Any origin, since the frame's own is opaque; `receive` checks every answer's source instead.
        frame.postMessage(visualResourceReadyMessage(this.html), '*');
        // The page writes itself as that message arrives and listens before the next one, so a theme
        // that changed since the frame's address was set follows right after it.
        this.postTheme(frame);
    }

    private postTheme(frame: VisualFrameWindow): void {
        this.sent = this.theme;
        frame.postMessage(visualHostContextMessage(this.theme), '*');
    }
}
