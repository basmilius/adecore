import { expect, test } from 'bun:test';
import { VISUAL_BRIDGE_METHODS, visualProxyReadyMessage, visualSizeChangedMessage } from '@adecore/agent-contracts/visual';
import { createPage } from '@adecore/editor/testing';
import { Activity, act } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatHostProvider } from '../../host';
import { VisualPageFrame } from './VisualFrame';

async function withVisual(
    run: (fixture: {
        frame(): HTMLIFrameElement;
        posts: Array<{ method: string; params?: unknown }>;
        reads(): number;
        visibility(visible: boolean): Promise<void>;
        receive(message: unknown, from?: HTMLIFrameElement): Promise<void>;
        scroll(top: number): Promise<void>;
    }) => Promise<void>
): Promise<void> {
    const page = createPage();
    const names = [
        'window',
        'document',
        'Node',
        'Element',
        'HTMLElement',
        'MutationObserver',
        'ResizeObserver',
        'getComputedStyle',
        'IS_REACT_ACT_ENVIRONMENT'
    ] as const;
    const previous = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
    const posts: Array<{ method: string; params?: unknown }> = [];
    const windows = new WeakMap<Element, { postMessage(message: { method: string }, origin: string): void }>();
    let reads = 0;

    const host = { visuals: { frameUrl: 'https://sandbox.test/frame', openLink: () => undefined } };
    const read = async (): Promise<string> => {
        reads += 1;

        return '<p>chart</p>';
    };

    const view = page.window as unknown as Window & typeof globalThis;
    const properties = ['clientWidth', 'clientHeight', 'offsetHeight', 'clientTop', 'getBoundingClientRect', 'contentWindow'] as const;
    const descriptors = properties.map((name) => Object.getOwnPropertyDescriptor(view.HTMLElement.prototype, name));

    Object.defineProperties(view.HTMLElement.prototype, {
        clientWidth: { get: () => 800, configurable: true },
        clientHeight: { get: () => 600, configurable: true },
        offsetHeight: {
            get(this: HTMLElement) {
                return this.classList.contains('chat-scroll') ? 600 : 3000;
            },
            configurable: true
        },
        clientTop: { get: () => 0, configurable: true },
        getBoundingClientRect: {
            value(this: HTMLElement) {
                const top = this.classList.contains('chat-scroll') ? 0 : 200 - (page.host.querySelector('.chat-scroll')?.scrollTop ?? 0);

                return { x: 0, y: top, top, left: 0, right: 800, bottom: top + 3000, width: 800, height: this.classList.contains('chat-scroll') ? 600 : 3000 };
            },
            configurable: true
        },
        contentWindow: {
            get(this: HTMLElement) {
                let target = windows.get(this);

                if (!target) {
                    target = { postMessage: (message) => posts.push(message) };
                    windows.set(this, target);
                }

                return target;
            },
            configurable: true
        }
    });

    view.getComputedStyle = (() => ({
        colorScheme: 'light',
        backgroundColor: 'rgb(255, 255, 255)',
        getPropertyValue: () => ''
    })) as unknown as typeof getComputedStyle;
    view.requestAnimationFrame = () => 0;
    view.cancelAnimationFrame = () => undefined;

    class Observer {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }

    Object.defineProperty(view, 'ResizeObserver', { value: Observer, configurable: true });

    for (const name of names) {
        Object.defineProperty(globalThis, name, {
            value: name === 'IS_REACT_ACT_ENVIRONMENT' ? true : name === 'window' ? view : view[name as keyof typeof view],
            configurable: true
        });
    }

    const root = createRoot(page.host);

    const visibility = async (visible: boolean): Promise<void> =>
        act(async () =>
            root.render(
                <ChatHostProvider host={host}>
                    <div className="chat-scroll">
                        <Activity mode={visible ? 'visible' : 'hidden'}>
                            <VisualPageFrame page={read} title="Chart" />
                        </Activity>
                    </div>
                </ChatHostProvider>
            )
        );

    const frame = (): HTMLIFrameElement => page.host.querySelector('iframe')!;

    try {
        await visibility(true);
        expect(frame()).not.toBeNull();

        await run({
            frame,
            posts,
            reads: () => reads,
            visibility,
            receive: async (message, from) =>
                act(async () => {
                    const event = new view.Event('message');
                    Object.defineProperties(event, { source: { value: (from ?? frame()).contentWindow }, data: { value: message } });
                    view.dispatchEvent(event);
                }),
            scroll: async (top) =>
                act(async () => {
                    const scroller = page.host.querySelector('.chat-scroll') as HTMLElement;
                    scroller.scrollTop = top;
                    scroller.dispatchEvent(new view.Event('scroll'));
                })
        });
    } finally {
        await act(async () => root.unmount());

        properties.forEach((name, index) => {
            const descriptor = descriptors[index];

            if (descriptor) {
                Object.defineProperty(view.HTMLElement.prototype, name, descriptor);
            } else {
                Reflect.deleteProperty(view.HTMLElement.prototype, name);
            }
        });

        names.forEach((name, index) => {
            if (previous[index]) {
                Object.defineProperty(globalThis, name, previous[index]!);
            } else {
                Reflect.deleteProperty(globalThis, name);
            }
        });
    }
}

test('an initialized visual retains its document and viewport bridge across Activity hide and reveal', async () => {
    await withVisual(async ({ frame, posts, reads, visibility, receive, scroll }) => {
        await receive(visualProxyReadyMessage());
        await receive(visualSizeChangedMessage({ width: 800, height: 3000 }));
        await receive({ jsonrpc: '2.0', method: VISUAL_BRIDGE_METHODS.viewportReady });
        const original = frame();
        const before = posts.filter((message) => message.method === VISUAL_BRIDGE_METHODS.viewportChanged).length;
        expect(before).toBeGreaterThan(0);
        await visibility(false);
        await visibility(true);
        const resumed = posts.filter((message) => message.method === VISUAL_BRIDGE_METHODS.viewportChanged).length;
        await scroll(300);
        expect(frame()).toBe(original);
        expect(reads()).toBe(1);
        expect(posts.filter((message) => message.method === VISUAL_BRIDGE_METHODS.sandboxResourceReady)).toHaveLength(1);
        expect(posts.filter((message) => message.method === VISUAL_BRIDGE_METHODS.viewportChanged).length).toBeGreaterThan(resumed);
    });
});

for (const started of [false, true]) {
    test('an incomplete visual handshake restarts safely after Activity reveal, started=' + started, async () => {
        await withVisual(async ({ frame, posts, reads, visibility, receive, scroll }) => {
            if (started) {
                await receive(visualProxyReadyMessage());
                await receive(visualSizeChangedMessage({ width: 800, height: 3000 }));
            }

            const original = frame();
            await visibility(false);
            await visibility(true);
            expect(frame()).not.toBe(original);
            const sent = posts.length;
            await receive(visualProxyReadyMessage(), original);
            expect(posts).toHaveLength(sent);
            await receive(visualProxyReadyMessage());
            await receive(visualSizeChangedMessage({ width: 800, height: 3000 }));
            await receive({ jsonrpc: '2.0', method: VISUAL_BRIDGE_METHODS.viewportReady });
            const before = posts.filter((message) => message.method === VISUAL_BRIDGE_METHODS.viewportChanged).length;
            await scroll(300);
            expect(reads()).toBe(1);
            expect(posts.filter((message) => message.method === VISUAL_BRIDGE_METHODS.sandboxResourceReady)).toHaveLength(started ? 2 : 1);
            expect(posts.filter((message) => message.method === VISUAL_BRIDGE_METHODS.viewportChanged).length).toBeGreaterThan(before);
        });
    });
}
