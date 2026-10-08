import { describe, expect, test } from 'bun:test';
import { ChatAttachResultSchema, ChatRemoveVisualPayloadSchema, ChatVisualsEventSchema } from './chat.ts';
import { AGENT_EVENT_SCHEMAS, AGENT_REQUEST_SCHEMAS } from './protocol.ts';
import {
    ChatVisualSchema,
    VISUAL_DARK_THEME,
    VISUAL_HOST_PAGE,
    VISUAL_LAYOUT_GUIDE,
    VISUAL_LIGHT_THEME,
    VISUAL_LIMITS,
    VISUAL_MEASURE_WIDTHS,
    VISUAL_PAGE_RULES,
    VISUAL_THEME_GUIDE,
    VISUAL_THEME_VARIABLES,
    cleanVisualVariables,
    injectVisualBootstrap,
    parseVisualMessage,
    visualFrameHeight,
    visualHostContextMessage,
    visualOpenLinkRequest,
    visualOpenLinkResult,
    visualProxyReadyMessage,
    visualResourceReadyMessage,
    visualSizeChangedMessage,
    visualScrollMessage,
    visualViewportMessage,
    VISUAL_BRIDGE_METHODS,
    visualThemeFragment,
    type VisualTheme
} from './visual.ts';

const META = '<meta charset="utf-8">';

describe('ChatVisualSchema and the wire', () => {
    const visual = { id: 'a1', title: 'Revenue', at: 10, maxHeight: 600, heights: [[320, 400]], size: 2048, turnId: 'turn-1' };

    test('a visual rides on attach, its event and the remove request', () => {
        expect(ChatVisualSchema.parse(visual)).toEqual(visual as never);
        expect(ChatAttachResultSchema.shape.visuals.parse([visual])).toHaveLength(1);
        expect(ChatVisualsEventSchema.parse({ chatId: 'chat-1', visuals: [visual] }).visuals).toHaveLength(1);
        expect(ChatRemoveVisualPayloadSchema.parse({ chatId: 'chat-1', visualId: 'a1' })).toEqual({ chatId: 'chat-1', visualId: 'a1' });
        expect(AGENT_REQUEST_SCHEMAS['chat.removeVisual'].result.parse({ visuals: [] })).toEqual({ visuals: [] });
        expect(AGENT_EVENT_SCHEMAS['chat.visuals']).toBe(ChatVisualsEventSchema);
    });

    test('accepts opt-in layouts without adding a field to older visuals', () => {
        expect(ChatVisualSchema.parse(visual)).not.toHaveProperty('layout');
        for (const layout of ['inline', 'wide'] as const) {
            expect(ChatVisualsEventSchema.parse({ chatId: 'chat-1', visuals: [{ ...visual, layout }] }).visuals[0]?.layout).toBe(layout);
        }
        expect(ChatVisualSchema.safeParse({ ...visual, layout: 'fullscreen' }).success).toBe(false);
    });

    test('checks shapes, not limits, so a host that widens one keeps older clients reading', () => {
        expect(ChatVisualSchema.safeParse({ ...visual, title: 't'.repeat(VISUAL_LIMITS.title + 1), maxHeight: 4000 }).success).toBe(true);
        expect(ChatVisualSchema.safeParse({ ...visual, title: '' }).success).toBe(false);
        expect(ChatVisualSchema.safeParse({ ...visual, heights: [[320]] }).success).toBe(false);
    });

    test('the measure widths run from a phone to a wide chat, ascending', () => {
        expect([...VISUAL_MEASURE_WIDTHS].sort((a, b) => a - b)).toEqual([...VISUAL_MEASURE_WIDTHS]);
        expect(VISUAL_MEASURE_WIDTHS[0]).toBeLessThanOrEqual(360);
        expect(VISUAL_MEASURE_WIDTHS.at(-1)).toBeGreaterThanOrEqual(1200);
    });
});

describe('visualFrameHeight', () => {
    const heights: [number, number][] = [
        [320, 900],
        [640, 500],
        [1000, 420]
    ];

    test('is undefined while nobody measured the page', () => {
        expect(visualFrameHeight({ maxHeight: 2000 }, 600)).toBeUndefined();
        expect(visualFrameHeight({ maxHeight: 2000, heights: [] }, 600)).toBeUndefined();
    });

    test('takes the measurement at a measured width', () => {
        expect(visualFrameHeight({ maxHeight: 2000, heights }, 640)).toBe(500);
    });

    test('takes the taller of the nearest widths on either side, in any order', () => {
        expect(visualFrameHeight({ maxHeight: 2000, heights }, 480)).toBe(900);
        expect(visualFrameHeight({ maxHeight: 2000, heights: [...heights].reverse() }, 800)).toBe(500);
    });

    test('takes the nearest one outside the measured range', () => {
        expect(visualFrameHeight({ maxHeight: 2000, heights }, 280)).toBe(900);
        expect(visualFrameHeight({ maxHeight: 2000, heights }, 1400)).toBe(420);
    });

    test('caps at the maximum height and stays within the limits, in whole pixels', () => {
        expect(visualFrameHeight({ maxHeight: 600, heights }, 320)).toBe(600);
        expect(visualFrameHeight({ maxHeight: 2000, heights: [[640, 12]] }, 640)).toBe(VISUAL_LIMITS.minHeight);
        expect(visualFrameHeight({ maxHeight: 9000, heights: [[640, 5000]] }, 640)).toBe(VISUAL_LIMITS.maxHeight);
        expect(visualFrameHeight({ maxHeight: 2000, heights: [[640, 300.2]] }, 640)).toBe(301);
    });
});

describe('the bridge', () => {
    const theme: VisualTheme = { appearance: 'light', variables: { '--background': '#fff' } };

    test('every message a builder makes reads back as itself', () => {
        expect(parseVisualMessage(visualViewportMessage({ top: 4200, height: 700 }))).toEqual({
            method: VISUAL_BRIDGE_METHODS.viewportChanged,
            viewport: { top: 4200, height: 700 }
        });
        expect(parseVisualMessage(visualViewportMessage(null))).toEqual({ method: VISUAL_BRIDGE_METHODS.viewportChanged, viewport: null });
        for (const request of [{ by: -55 }, { to: 3200 }, { edge: 'end' as const }]) {
            expect(parseVisualMessage(visualScrollMessage(request))).toEqual({ method: VISUAL_BRIDGE_METHODS.scrollRequest, request });
        }
        expect(parseVisualMessage(visualProxyReadyMessage())).toEqual({ method: 'ui/notifications/sandbox-proxy-ready' });
        expect(parseVisualMessage(visualResourceReadyMessage('<p>hi</p>'))).toEqual({ method: 'ui/notifications/sandbox-resource-ready', html: '<p>hi</p>' });
        expect(parseVisualMessage(visualHostContextMessage(theme))).toEqual({ method: 'ui/notifications/host-context-changed', theme });
        expect(parseVisualMessage(visualSizeChangedMessage({ width: 600, height: 240 }))).toEqual({
            method: 'ui/notifications/size-changed',
            width: 600,
            height: 240
        });
        expect(parseVisualMessage(visualOpenLinkRequest(7, 'https://example.com/a?b=1'))).toEqual({
            method: 'ui/open-link',
            id: 7,
            url: 'https://example.com/a?b=1'
        });
    });

    test('the builders write JSON-RPC 2.0, and the host context in its MCP Apps shape', () => {
        expect(visualHostContextMessage(theme)).toEqual({
            jsonrpc: '2.0',
            method: 'ui/notifications/host-context-changed',
            params: { theme: 'light', styles: { variables: { '--background': '#fff' } } }
        });
        expect(visualOpenLinkResult('r1')).toEqual({ jsonrpc: '2.0', id: 'r1', result: {} });
    });

    test('ignores what is no message of the bridge', () => {
        for (const data of [null, 'ui/open-link', [], { method: 'ui/notifications/sandbox-proxy-ready' }, { jsonrpc: '2.0', method: 'ui/other' }]) {
            expect(parseVisualMessage(data)).toBeUndefined();
        }
        expect(parseVisualMessage({ jsonrpc: '2.0', method: 'ui/notifications/sandbox-resource-ready' })).toBeUndefined();
        expect(parseVisualMessage({ jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { theme: 'sepia' } })).toBeUndefined();
    });

    test('reads leniently: fields it does not know are ignored, and a size may come without a width', () => {
        expect(parseVisualMessage({ jsonrpc: '2.0', method: 'ui/notifications/size-changed', params: { height: 300, unit: 'px' }, extra: 1 })).toEqual({
            method: 'ui/notifications/size-changed',
            height: 300
        });
        expect(parseVisualMessage({ jsonrpc: '2.0', method: 'ui/notifications/size-changed', params: { width: 10, height: -1 } })).toBeUndefined();
        expect(
            parseVisualMessage({ jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { theme: 'dark', displayMode: 'inline' } })
        ).toEqual({
            method: 'ui/notifications/host-context-changed',
            theme: { appearance: 'dark', variables: {} }
        });
    });

    test('refuses malformed viewport and scroll messages', () => {
        for (const params of [{ top: -1, height: 400 }, { top: 0, height: 0 }, { top: Infinity, height: 400 }, null]) {
            if (params !== null) {
                expect(parseVisualMessage({ jsonrpc: '2.0', method: VISUAL_BRIDGE_METHODS.viewportChanged, params })).toBeUndefined();
            }
        }
        for (const params of [{ by: NaN }, { to: -1 }, { by: '20' }, { edge: 'elsewhere' }]) {
            expect(parseVisualMessage({ jsonrpc: '2.0', method: VISUAL_BRIDGE_METHODS.scrollRequest, params })).toBeUndefined();
        }
    });

    test('opens only http and https links, and only on a request with an id', () => {
        const request = (url: unknown, id: unknown = 1) => parseVisualMessage({ jsonrpc: '2.0', id, method: 'ui/open-link', params: { url } });
        expect(request('http://example.com')).toEqual({ method: 'ui/open-link', id: 1, url: 'http://example.com/' });
        for (const url of ['javascript:alert(1)', 'file:///etc/hosts', 'mailto:a@example.com', '/relative', 'not a url', 42]) {
            expect(request(url)).toBeUndefined();
        }
        expect(request('https://example.com', null)).toBeUndefined();
        expect(request('https://example.com', Number.NaN)).toBeUndefined();
    });
});

describe('the theme', () => {
    test('both default palettes hold every variable and nothing else', () => {
        for (const theme of [VISUAL_LIGHT_THEME, VISUAL_DARK_THEME]) {
            expect(Object.keys(theme.variables).sort()).toEqual([...VISUAL_THEME_VARIABLES].sort());
            expect(cleanVisualVariables(theme.variables)).toEqual({ ...theme.variables });
        }
        expect(VISUAL_LIGHT_THEME.appearance).toBe('light');
        expect(VISUAL_DARK_THEME.appearance).toBe('dark');
    });

    test('keeps only names and values that cannot break out of their rule', () => {
        expect(
            cleanVisualVariables({
                '--background': '  #101010 ',
                '--font-sans': '"Inter", system-ui, sans-serif',
                background: 'red',
                '--Upper': 'red',
                '--a_b': 'red',
                '--semi': 'red; color: blue',
                '--brace': 'red}html{display:none',
                '--tag': 'red</style><script>',
                '--escape': 'red\\',
                '--comment': 'red /* rest',
                '--line': 'red\nhtml{}',
                '--empty': '   ',
                '--number': 4
            })
        ).toEqual({ '--background': '#101010', '--font-sans': '"Inter", system-ui, sans-serif' });
        expect(cleanVisualVariables('--background: red')).toEqual({});
        expect(cleanVisualVariables({ '--long': 'x'.repeat(513) })).toEqual({});
    });

    test('a fragment holds the theme as one URI-encoded JSON key', () => {
        const theme: VisualTheme = { appearance: 'dark', variables: { '--background': '#000', '--font-sans': '"A B", sans-serif' } };
        const fragment = visualThemeFragment(theme);
        expect(fragment.startsWith('#visual-theme=')).toBe(true);
        expect(fragment).not.toMatch(/[#&]\S*[#&]/);
        expect(JSON.parse(decodeURIComponent(fragment.slice('#visual-theme='.length)))).toEqual(theme);
    });

    test('the guides for an agent name the limit, the widths and every variable', () => {
        expect(VISUAL_PAGE_RULES).toContain('16 MiB');
        expect(VISUAL_LAYOUT_GUIDE).toContain('768px');
        expect(VISUAL_LAYOUT_GUIDE).toContain('wide layout');
        for (const name of VISUAL_THEME_VARIABLES) {
            expect(VISUAL_THEME_GUIDE).toContain(name);
        }
        expect(`${VISUAL_PAGE_RULES}${VISUAL_LAYOUT_GUIDE}${VISUAL_THEME_GUIDE}`).not.toMatch(/[–—]/);
    });
});

/* Where the bootstrap landed: the text before its charset and the text after its script. */
function around(html: string): { before: string; after: string } {
    const result = injectVisualBootstrap(html);
    const start = result.indexOf(META);
    const end = result.indexOf('</script>', start) + '</script>'.length;
    expect(start).toBeGreaterThanOrEqual(0);
    return { before: result.slice(0, start), after: result.slice(end) };
}

describe('injectVisualBootstrap', () => {
    test('goes at the very start of the head, after a doctype and an html tag', () => {
        const page = '<!DOCTYPE html>\n<html lang="en">\n<head data-x="a>b">\n<title>Chart</title>\n</head><body></body></html>';
        expect(around(page)).toEqual({
            before: '<!DOCTYPE html>\n<html lang="en">\n<head data-x="a>b">',
            after: '\n<title>Chart</title>\n</head><body></body></html>'
        });
    });

    test('makes a head where the page has none', () => {
        expect(around('<!doctype html><html><body><p>hi</p></body></html>')).toEqual({
            before: '<!doctype html><html><head>',
            after: '</head><body><p>hi</p></body></html>'
        });
        expect(around('<div id="chart"></div>')).toEqual({ before: '<head>', after: '</head><div id="chart"></div>' });
        expect(around('<!DOCTYPE html>')).toEqual({ before: '<!DOCTYPE html><head>', after: '</head>' });
        expect(around('')).toEqual({ before: '<head>', after: '</head>' });
    });

    test('keeps a doctype first, also after a comment, and reads tags in any case', () => {
        expect(around('<!-- made by hand --><!doctype html><p>x</p>').before).toBe('<!-- made by hand --><!doctype html><head>');
        expect(around('<HTML><HEAD><TITLE>x</TITLE></HEAD></HTML>').before).toBe('<HTML><HEAD>');
    });

    test('never takes inert markup for the head', () => {
        expect(around('<!-- <head> --><p>hi</p>')).toEqual({ before: '<!-- <head> --><head>', after: '</head><p>hi</p>' });
        expect(around('<script>const head = "<head>";</script><head></head>')).toEqual({
            before: '<head>',
            after: '</head><script>const head = "<head>";</script><head></head>'
        });
        expect(around('<template><head><title>x</title></head></template><p>x</p>').before).toBe('<head>');
        expect(around('<html><header>Top</header></html>').before).toBe('<html><head>');
        expect(around('<!--> <head> <p>x</p>').before).toBe('<!--> <head>');
    });

    test('adds a viewport only when the page sets none of its own', () => {
        const viewport = '<meta name="viewport"';
        expect(injectVisualBootstrap('<p>x</p>')).toContain(viewport);
        expect(injectVisualBootstrap('<head><meta name="viewport" content="width=600"></head>').split(viewport)).toHaveLength(2);
        expect(injectVisualBootstrap("<head><meta content='width=600' name=viewport></head>").split('name="viewport"')).toHaveLength(1);
        expect(injectVisualBootstrap('<template><meta name="viewport" content="width=600"></template>').split(viewport)).toHaveLength(3);
        expect(injectVisualBootstrap('<script>"<meta name=viewport>"</script>').split(viewport)).toHaveLength(2);
    });

    test('holds the default theme, dark with light under the light color scheme, and the base stylesheet', () => {
        const css = /<style data-visual-theme>([\s\S]*?)<\/style>/.exec(injectVisualBootstrap(''))![1]!;
        expect(css.startsWith(':root{color-scheme:dark;')).toBe(true);
        expect(css).toContain(`--background:${VISUAL_DARK_THEME.variables['--background']};`);
        expect(css).toContain(
            `@media (prefers-color-scheme: light){\n:root{color-scheme:light;\n--background:${VISUAL_LIGHT_THEME.variables['--background']};`
        );
        expect(css).toContain('font-size:14px');
        expect(css).toContain('body{margin:0}');
        expect(css).toContain('scrollbar-width:none');
    });
});

interface FakeElement {
    tagName: string;
    attributes: Record<string, string>;
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
}

function element(tagName: string, attributes: Record<string, string> = {}): FakeElement {
    return {
        tagName,
        attributes,
        getAttribute: (name) => attributes[name] ?? null,
        setAttribute: (name, value) => {
            attributes[name] = value;
        }
    };
}

interface FakeEvent {
    isTrusted: boolean;
    prevented: boolean;
    composedPath(): unknown[];
    preventDefault(): void;
}

function click(path: unknown[], isTrusted = true): FakeEvent {
    return {
        isTrusted,
        prevented: false,
        composedPath: () => path,
        preventDefault() {
            this.prevented = true;
        }
    };
}

/*
 * The bootstrap's script run against a document of plain objects: what it writes in its style, what
 * it posts to the parent, what it does to the address and what it asks of the next frame.
 */
function boot(options: { hash?: string; framed?: boolean; another?: boolean } = {}) {
    const html = injectVisualBootstrap('<p>x</p>');
    const source = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;
    const css = /<style data-visual-theme>([\s\S]*?)<\/style>/.exec(html)![1]!;
    const removed: string[] = [];
    const style = { textContent: css, remove: () => removed.push('style') };
    const script = { previousElementSibling: style, remove: () => removed.push('script') };
    const posted: unknown[] = [];
    const parent = { postMessage: (data: unknown, origin: string) => posted.push({ data, origin }) };
    const listeners = new Map<string, (event: unknown) => void>();
    const window: Record<string, unknown> = {
        addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
        matchMedia: () => ({ matches: false })
    };
    window.parent = options.framed === false ? window : parent;
    const hash = options.hash ?? '';
    const location = { hash, href: `https://sandbox.example/host.html${hash}` };
    const replaced: string[] = [];
    const history = { state: null, replaceState: (_state: unknown, _title: string, url: string) => replaced.push(url) };
    const root = { box: { width: 600.4, height: 120 }, getBoundingClientRect: () => root.box };
    const document = {
        currentScript: script,
        documentElement: root,
        baseURI: 'https://sandbox.example/host.html',
        querySelector: () => (options.another ? {} : style)
    };
    const resized: Array<() => void> = [];
    class FakeResizeObserver {
        constructor(callback: () => void) {
            resized.push(callback);
        }
        observe(): void {}
    }
    const frames: Array<() => void> = [];
    new Function('window', 'document', 'location', 'history', 'ResizeObserver', 'requestAnimationFrame', source)(
        window,
        document,
        location,
        history,
        FakeResizeObserver,
        (callback: () => void) => frames.push(callback)
    );
    return {
        css,
        style,
        removed,
        posted,
        parent,
        listeners,
        replaced,
        root,
        resize: () => resized.forEach((callback) => callback()),
        frames,
        flush: () => frames.splice(0).forEach((callback) => callback())
    };
}

describe('the bootstrap script', () => {
    test('leaves the default theme alone without a fragment', () => {
        const page = boot();
        expect(page.style.textContent).toBe(page.css);
        expect(page.replaced).toEqual([]);
    });

    test('applies a theme from the fragment before the first paint, over the defaults, and takes the fragment off', () => {
        const theme: VisualTheme = { appearance: 'light', variables: { '--background': '#fefefe', '--brace': 'red}html{display:none', bad: 'x' } };
        const page = boot({ hash: visualThemeFragment(theme) });
        expect(page.style.textContent).toStartWith(':root{color-scheme:light;\n');
        expect(page.style.textContent).toContain('--background:#fefefe;');
        expect(page.style.textContent).toContain(`--chart-6:${VISUAL_LIGHT_THEME.variables['--chart-6']};`);
        expect(page.style.textContent).not.toContain('--brace');
        expect(page.style.textContent).not.toContain('bad');
        expect(page.style.textContent).toEndWith('body{margin:0}');
        expect(page.replaced).toEqual(['https://sandbox.example/host.html']);
    });

    test("keeps the page's own hash when it takes the theme off the address", () => {
        const page = boot({ hash: `#route=1&${visualThemeFragment(VISUAL_DARK_THEME).slice(1)}` });
        expect(page.style.textContent).toStartWith(':root{color-scheme:dark;');
        expect(page.replaced).toEqual(['#route=1']);
    });

    test('survives a fragment that is no theme', () => {
        const page = boot({ hash: '#visual-theme=%7Bnot%20json' });
        expect(page.style.textContent).toBe(page.css);
        expect(page.replaced).toEqual(['https://sandbox.example/host.html']);
    });

    test('applies the host context the parent sends, and nothing from anyone else', () => {
        const page = boot();
        const message = page.listeners.get('message')!;
        message({ source: {}, data: visualHostContextMessage({ appearance: 'light', variables: { '--background': '#abcdef' } }) });
        expect(page.style.textContent).toBe(page.css);
        message({ source: page.parent, data: null });
        message({ source: page.parent, data: { jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: 'dark' } });
        message({ source: page.parent, data: visualHostContextMessage({ appearance: 'light', variables: { '--background': '#abcdef', '--x': 'a;b' } }) });
        expect(page.style.textContent).toStartWith(':root{color-scheme:light;\n');
        expect(page.style.textContent).toContain('--background:#abcdef;');
        expect(page.style.textContent).not.toContain('--x:');
        // A partial update keeps what it does not name.
        message({ source: page.parent, data: { jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { theme: 'dark' } } });
        expect(page.style.textContent).toStartWith(':root{color-scheme:dark;\n');
        expect(page.style.textContent).toContain('--background:#abcdef;');
    });

    test('asks the parent to open a link to another http(s) document, found through the composed path', () => {
        const page = boot();
        const listener = page.listeners.get('click')!;
        const anchor = element('A', { href: 'https://example.com/docs' });
        const first = click([element('SPAN'), anchor, element('BODY')]);
        listener(first);
        expect(first.prevented).toBe(true);
        listener(click([element('svg:a'), element('a', { 'xlink:href': 'http://example.com/svg' })]));
        expect(page.posted).toEqual([
            { data: visualOpenLinkRequest(1, 'https://example.com/docs'), origin: '*' },
            { data: visualOpenLinkRequest(2, 'http://example.com/svg'), origin: '*' }
        ]);
    });

    test('leaves untrusted clicks, links within the page and other schemes alone', () => {
        const page = boot();
        const listener = page.listeners.get('click')!;
        const events = [
            click([element('A', { href: 'https://example.com' })], false),
            click([element('A', { href: '#section' })]),
            click([element('A', { href: 'mailto:a@example.com' })]),
            click([element('A', { href: 'javascript:void(0)' })]),
            click([element('A')]),
            click([element('DIV')])
        ];
        for (const event of events) {
            listener(event);
            expect(event.prevented).toBe(false);
        }
        expect(page.posted).toEqual([]);
    });

    test('as a top-level document, opens a link in a new browsing context instead', () => {
        const page = boot({ framed: false });
        const anchor = element('A', { href: 'https://example.com' });
        const event = click([anchor]);
        page.listeners.get('click')!(event);
        expect(event.prevented).toBe(false);
        expect(anchor.attributes).toEqual({ href: 'https://example.com', target: '_blank', rel: 'noopener' });
        page.resize();
        expect(page.frames).toEqual([]);
        expect(page.posted).toEqual([]);
    });

    test("reports the root's own box at most once per frame, and only when it changed", () => {
        const page = boot();
        page.resize();
        page.resize();
        expect(page.frames).toHaveLength(1);
        page.flush();
        page.resize();
        page.flush();
        page.root.box = { width: 600, height: 340.5 };
        page.resize();
        page.flush();
        expect(page.posted).toEqual([
            { data: visualSizeChangedMessage({ width: 601, height: 120 }), origin: '*' },
            { data: visualSizeChangedMessage({ width: 600, height: 341 }), origin: '*' }
        ]);
    });

    test('a second bootstrap in the same document takes itself out', () => {
        const page = boot({ another: true });
        expect(page.removed).toEqual(['style', 'script']);
        expect(page.listeners.size).toBe(0);
    });
});

/*
 * The sandbox host page's script run against a window and a document of plain objects, since this
 * package has no DOM to load it in: what it posts to its parent and what it writes into itself.
 */
function host(options: { framed?: boolean } = {}) {
    const source = /<script>([\s\S]*?)<\/script>/.exec(VISUAL_HOST_PAGE)![1]!;
    const posted: unknown[] = [];
    const parent = { postMessage: (data: unknown, origin: string) => posted.push({ data, origin }) };
    const listeners: Array<(event: unknown) => void> = [];
    const window: Record<string, unknown> = {
        addEventListener: (type: string, listener: (event: unknown) => void) => {
            if (type === 'message') {
                listeners.push(listener);
            }
        }
    };
    window.parent = options.framed === false ? window : parent;
    const written: string[] = [];
    const installed: string[] = [];
    const document = {
        open: () => written.push('open'),
        write: (html: string) => written.push(`write ${html}`),
        close: () => written.push('close'),
        createElement: () => ({ textContent: '' }),
        head: { appendChild: (script: { textContent: string }) => installed.push(script.textContent) }
    };
    new Function('window', 'document', source)(window, document);
    const send = (data: unknown, source: unknown = parent): void => listeners.forEach((listener) => listener({ source, data }));
    return { posted, listeners, written, installed, send };
}

describe('the sandbox host page', () => {
    test('is one UTF-8 document with one inline script, and no policy of its own', () => {
        expect(VISUAL_HOST_PAGE).toStartWith('<!doctype html>\n<html><head><meta charset="utf-8"><script>');
        expect(VISUAL_HOST_PAGE.match(/<script/g)).toHaveLength(1);
        expect(VISUAL_HOST_PAGE).not.toContain('Content-Security-Policy');
        expect(VISUAL_HOST_PAGE).not.toMatch(/\ssrc=/);
    });

    test('tells its parent that it listens, to any origin, since its own is opaque', () => {
        expect(host().posted).toEqual([{ data: visualProxyReadyMessage(), origin: '*' }]);
    });

    test('opened on its own it says nothing and listens to nobody', () => {
        const page = host({ framed: false });
        expect(page.posted).toEqual([]);
        expect(page.listeners).toEqual([]);
    });

    test('becomes the first page its parent sends, once', () => {
        const page = host();
        page.send(visualResourceReadyMessage('<p>one</p>'));
        page.send(visualResourceReadyMessage('<p>two</p>'));
        expect(page.written).toEqual(['open', 'write <p>one</p>', 'close']);
        expect(page.installed).toHaveLength(1);
        expect(page.installed[0]).toContain(VISUAL_BRIDGE_METHODS.viewportReady);
    });

    test('ignores a page from anyone but its parent, and every other message', () => {
        const page = host();
        page.send(visualResourceReadyMessage('<p>stranger</p>'), {});
        page.send(null);
        page.send('<p>bare</p>');
        page.send({ jsonrpc: '2.0', method: 'ui/notifications/sandbox-resource-ready', params: { html: 7 } });
        page.send({ method: 'ui/notifications/sandbox-resource-ready', params: { html: '<p>no version</p>' } });
        page.send(visualHostContextMessage(VISUAL_DARK_THEME));
        expect(page.written).toEqual([]);
        page.send(visualResourceReadyMessage('<p>parent</p>'));
        expect(page.written).toEqual(['open', 'write <p>parent</p>', 'close']);
    });
});
