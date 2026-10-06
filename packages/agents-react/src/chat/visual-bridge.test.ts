import { describe, expect, test } from 'bun:test';
import {
    VISUAL_LIMITS,
    visualHostContextMessage,
    visualOpenLinkRequest,
    visualOpenLinkResult,
    visualProxyReadyMessage,
    visualResourceReadyMessage,
    visualSizeChangedMessage,
    type VisualAppearance,
    type VisualTheme
} from '@adecore/agent-contracts/visual';
import { VisualBridge, type VisualBridgeOptions } from './visual-bridge';

const DARK: VisualTheme = { appearance: 'dark', variables: { '--background': 'rgb(19, 19, 22)' } };
const LIGHT: VisualTheme = { appearance: 'light', variables: { '--background': 'rgb(255, 255, 255)' } };

function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/* A bridge over a frame of plain objects, with what it posted, reported and opened, and a clock that only moves when told. */
function setup(overrides: Partial<VisualBridgeOptions> = {}) {
    const posted: unknown[] = [];
    const frame = { postMessage: (message: unknown, origin: string) => posted.push({ message, origin }) };
    const heights: number[] = [];
    const appearances: VisualAppearance[] = [];
    const opened: string[] = [];
    const timers: Array<{ ms: number; run: () => void; cancelled: boolean }> = [];
    let failures = 0;
    let acting = true;
    const bridge = new VisualBridge({
        frame: () => frame,
        visual: { maxHeight: 900 },
        page: Promise.resolve('<p>chart</p>'),
        theme: DARK,
        mayOpenLink: () => acting,
        openLink: (url) => opened.push(url),
        onHeight: (height) => heights.push(height),
        onAppearance: (appearance) => appearances.push(appearance),
        onFailure: () => {
            failures += 1;
        },
        after: (ms, run) => {
            const timer = { ms, run, cancelled: false };
            timers.push(timer);
            return () => {
                timer.cancelled = true;
            };
        },
        ...overrides
    });
    const fromFrame = (data: unknown): void => bridge.receive({ source: frame, data });
    return {
        bridge,
        frame,
        posted,
        heights,
        appearances,
        opened,
        timers,
        fromFrame,
        failures: () => failures,
        setActing: (next: boolean) => {
            acting = next;
        },
        // What the bridge posted into the frame, without the origin, which is always `*`.
        messages: () => posted.map((entry) => (entry as { message: unknown }).message)
    };
}

describe('VisualBridge', () => {
    test('answers the sandbox host page with the page and the theme it is in now, to any origin', async () => {
        const frame = setup();
        await flush();
        expect(frame.posted).toEqual([]);
        frame.fromFrame(visualProxyReadyMessage());
        expect(frame.posted).toEqual([
            { message: visualResourceReadyMessage('<p>chart</p>'), origin: '*' },
            { message: visualHostContextMessage(DARK), origin: '*' }
        ]);
    });

    test('sends a page that is read after the host page asked as soon as it is there', async () => {
        let resolve: (html: string) => void = () => undefined;
        const frame = setup({ page: new Promise<string>((done) => (resolve = done)) });
        frame.fromFrame(visualProxyReadyMessage());
        expect(frame.posted).toEqual([]);
        resolve('<p>late</p>');
        await flush();
        expect(frame.messages()).toEqual([visualResourceReadyMessage('<p>late</p>'), visualHostContextMessage(DARK)]);
    });

    test('ignores every message that is not from its own frame, and anything that is no message of the bridge', async () => {
        const frame = setup();
        await flush();
        frame.bridge.receive({ source: {}, data: visualProxyReadyMessage() });
        frame.bridge.receive({ source: null, data: visualProxyReadyMessage() });
        frame.fromFrame({ method: 'ui/notifications/sandbox-proxy-ready' });
        frame.fromFrame('ready');
        expect(frame.posted).toEqual([]);
    });

    test('a frame that is gone hears nothing', async () => {
        const frame = setup({ frame: () => null });
        await flush();
        frame.bridge.receive({ source: null, data: visualProxyReadyMessage() });
        expect(frame.posted).toEqual([]);
    });

    test('a page reports sizes only once it was sent, and only within its maximum and the limits', async () => {
        const frame = setup();
        await flush();
        frame.fromFrame(visualSizeChangedMessage({ width: 600, height: 300 }));
        expect(frame.heights).toEqual([]);
        frame.fromFrame(visualProxyReadyMessage());
        frame.fromFrame(visualSizeChangedMessage({ width: 600, height: 300.2 }));
        frame.fromFrame(visualSizeChangedMessage({ width: 600, height: 4000 }));
        frame.fromFrame(visualSizeChangedMessage({ width: 600, height: 10 }));
        expect(frame.heights).toEqual([301, 900, VISUAL_LIMITS.minHeight]);
    });

    test('says the appearance the page is drawn in from its first size, and again with every theme after that', async () => {
        const frame = setup();
        await flush();
        frame.fromFrame(visualProxyReadyMessage());
        expect(frame.appearances).toEqual([]);
        frame.fromFrame(visualSizeChangedMessage({ width: 600, height: 300 }));
        frame.fromFrame(visualSizeChangedMessage({ width: 600, height: 320 }));
        expect(frame.appearances).toEqual(['dark']);
        frame.bridge.setTheme(LIGHT);
        expect(frame.appearances).toEqual(['dark', 'light']);
    });

    test('keeps a theme to itself until the page was sent, and sends the newest one with it', async () => {
        const frame = setup();
        await flush();
        frame.bridge.setTheme(LIGHT);
        expect(frame.posted).toEqual([]);
        frame.fromFrame(visualProxyReadyMessage());
        expect(frame.messages()).toEqual([visualResourceReadyMessage('<p>chart</p>'), visualHostContextMessage(LIGHT)]);
        frame.bridge.setTheme(DARK);
        expect(frame.messages().at(-1)).toEqual(visualHostContextMessage(DARK));
    });

    test('a frame that loads again gets the page again and draws in the theme of now', async () => {
        const frame = setup();
        await flush();
        frame.fromFrame(visualProxyReadyMessage());
        frame.fromFrame(visualSizeChangedMessage({ width: 600, height: 300 }));
        frame.bridge.setTheme(LIGHT);
        frame.fromFrame(visualProxyReadyMessage());
        expect(frame.messages().slice(-2)).toEqual([visualResourceReadyMessage('<p>chart</p>'), visualHostContextMessage(LIGHT)]);
        frame.fromFrame(visualSizeChangedMessage({ width: 600, height: 300 }));
        expect(frame.appearances).toEqual(['dark', 'light', 'light']);
    });

    test('opens a link only while a person acts in the frame, and answers the request either way', async () => {
        const frame = setup();
        await flush();
        frame.fromFrame(visualOpenLinkRequest(1, 'https://example.com/early'));
        expect(frame.posted).toEqual([]);
        frame.fromFrame(visualProxyReadyMessage());
        frame.fromFrame(visualOpenLinkRequest(2, 'https://example.com/clicked'));
        frame.setActing(false);
        frame.fromFrame(visualOpenLinkRequest(3, 'https://example.com/scripted'));
        frame.fromFrame(visualOpenLinkRequest(4, 'javascript:alert(1)'));
        expect(frame.opened).toEqual(['https://example.com/clicked']);
        expect(frame.messages().slice(2)).toEqual([visualOpenLinkResult(2), visualOpenLinkResult(3)]);
    });

    test('a page it cannot read is a failure', async () => {
        const frame = setup({ page: Promise.reject(new Error('gone')) });
        await flush();
        expect(frame.failures()).toBe(1);
    });

    test('a frame that loaded without the sandbox host page saying a word fails once the margin passed', async () => {
        const frame = setup();
        await flush();
        frame.bridge.loaded();
        expect(frame.timers.map((timer) => timer.ms)).toEqual([3000]);
        frame.timers[0]!.run();
        expect(frame.failures()).toBe(1);
    });

    test('a host page that spoke never fails on silence, whatever order its message and the load come in', async () => {
        const early = setup();
        await flush();
        early.fromFrame(visualProxyReadyMessage());
        early.bridge.loaded();
        expect(early.timers).toEqual([]);

        const late = setup();
        await flush();
        late.bridge.loaded();
        late.fromFrame(visualProxyReadyMessage());
        expect(late.timers[0]!.cancelled).toBe(true);
        late.timers[0]!.run();
        expect(late.failures()).toBe(0);
    });

    test('says nothing and posts nothing once disposed', async () => {
        const frame = setup();
        await flush();
        frame.bridge.dispose();
        frame.fromFrame(visualProxyReadyMessage());
        frame.bridge.setTheme(LIGHT);
        expect(frame.posted).toEqual([]);
    });
});
