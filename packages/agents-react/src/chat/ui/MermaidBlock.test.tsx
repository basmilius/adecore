import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderAsync } from 'pele/lazy';
import { createPage } from '@adecore/editor/testing';
import { ChatHostProvider, type ChatHost } from '../../host';
import type { Highlighter } from './highlighter';
import { MermaidBlock } from './MermaidBlock';

const DIAGRAM = 'graph TD\n  A-->B';

// Pele loads what a flowchart needs once, so a test waits on the drawing and not on a module.
await renderAsync(DIAGRAM);

/* The tokens of the theme where the diagram stands, as the page would compute them. */
let tokens: Record<string, string>;
let tokenReads: number;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

const highlighter = {
    getLoadedLanguages: () => ['mermaid'],
    getLoadedThemes: () => ['github-light'],
    loadLanguage: async () => undefined,
    loadTheme: async () => undefined,
    getTheme: () => ({ fg: '#000000' }),
    codeToTokens: (code: string) => ({ tokens: code.split('\n').map((line) => [{ content: line, offset: 0 }]), grammarState: undefined })
} as unknown as Highlighter;

const code: ChatHost['code'] = {
    useMode: () => 'light',
    useThemes: () => ({ light: 'github-light', dark: 'github-dark' }),
    custom: [],
    highlighter: async () => highlighter
};

/* A 2D context that paints the last opaque `#rrggbb` it was handed and measures every character alike. */
function probeContext() {
    let fill = '#000000';
    let painted = '#000000';

    return {
        get fillStyle() {
            return fill;
        },
        set fillStyle(value: string) {
            fill = value;
        },
        fillRect: () => {
            painted = /^#[\da-f]{6}$/i.test(fill) ? fill : painted;
        },
        getImageData: () => ({ data: [1, 3, 5].map((at) => Number.parseInt(painted.slice(at, at + 2), 16)) }),
        measureText: (text: string) => ({ width: text.length * 8 })
    };
}

const GLOBALS = [
    'window',
    'document',
    'Node',
    'Element',
    'HTMLElement',
    'IS_REACT_ACT_ENVIRONMENT',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame'
];

let previous: (PropertyDescriptor | undefined)[];
let page: ReturnType<typeof createPage>;
let root: Root;
// The page's canvas class is shared by every page of the run, so its own `getContext` goes back after each test.
let canvas: { prototype: { getContext: unknown } };
let ownContext: unknown;

beforeEach(() => {
    tokenReads = 0;

    tokens = {
        '--chat-code-bg': '#f0f0f0',
        '--surface-raised': '#ffffff',
        '--border-strong': '#cccccc',
        '--text': '#111111',
        '--text-muted': '#666666',
        '--surface': '#fafafa',
        '--accent': '#3366ff'
    };

    frames = new Map();
    nextFrame = 1;
    page = createPage();
    canvas = page.document.createElement('canvas').constructor as unknown as typeof canvas;
    ownContext = canvas.prototype.getContext;
    canvas.prototype.getContext = () => probeContext();

    const values: Record<string, unknown> = {
        window: page.window,
        IS_REACT_ACT_ENVIRONMENT: true,
        getComputedStyle: () => ({
            getPropertyValue: (token: string) => {
                tokenReads++;

                return tokens[token] ?? '';
            },
            fontFamily: 'sans-serif',
            fontSize: '14px'
        }),
        requestAnimationFrame: (callback: FrameRequestCallback) => {
            frames.set(nextFrame, callback);

            return nextFrame++;
        },
        cancelAnimationFrame: (handle: number) => frames.delete(handle)
    };

    previous = GLOBALS.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));

    for (const name of GLOBALS) {
        const value = name in values ? values[name] : page.window[name as keyof Window];
        Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    }

    root = createRoot(page.host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    canvas.prototype.getContext = ownContext;

    GLOBALS.forEach((name, index) => {
        const descriptor = previous[index];

        if (descriptor === undefined) {
            Reflect.deleteProperty(globalThis, name);
        } else {
            Object.defineProperty(globalThis, name, descriptor);
        }
    });
});

/* Lets Pele finish what it was asked for. */
async function settle(): Promise<void> {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

/* Lets the observer deliver what changed on the root, then runs the frame it asked for. */
async function nextPaint(): Promise<void> {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        const due = [...frames.values()];
        frames.clear();

        for (const callback of due) {
            callback(0);
        }
    });

    await settle();
}

function drawnImage(): string | null {
    return decodeURIComponent(page.host.querySelector('img')?.getAttribute('src') ?? '') || null;
}

/* The drawing without the colors written on its root. */
function laidOut(image: string | null): string | null {
    return image?.replace(/^(data:[^,]*,<svg\b[^>]*?style=")[^"]*?(--_bg:)/, '$1$2') ?? null;
}

async function drawDiagram(source = DIAGRAM): Promise<void> {
    await act(async () =>
        root.render(
            <ChatHostProvider host={{ code }}>
                <MermaidBlock code={source} />
            </ChatHostProvider>
        )
    );

    await settle();
}

test('a diagram is drawn in the colors of the theme where it stands', async () => {
    await drawDiagram();
    expect(drawnImage()).toContain('--pele-fg:#111111;');
    expect(drawnImage()).toContain('--pele-surface:#ffffff;');
    expect(drawnImage()).toContain('--pele-accent:#3366ff;');
    // A token the theme leaves out takes the ground rather than a color of Pele's own.
    expect(drawnImage()).toContain('--pele-critical:#f0f0f0;');
});

test('a diagram takes the colors the app switches to within the same side, without leaving the screen', async () => {
    await drawDiagram();
    const before = drawnImage();

    // The app writes a palette with another accent and touches the root's style to say so.
    tokens['--accent'] = '#ff6633';
    page.document.documentElement.style.setProperty('--palette-revision', '1');
    await nextPaint();
    expect(drawnImage()).toContain('--pele-accent:#ff6633;');
    expect(laidOut(drawnImage())).toBe(laidOut(before));
});

test('a change of the root that leaves every color as it was changes nothing, and nothing loops', async () => {
    await drawDiagram();
    const before = drawnImage();
    // A dialog that locks the scroll writes the root's style too.
    page.document.documentElement.style.setProperty('overflow', 'hidden');
    page.document.body.className = 'scroll-locked';
    await nextPaint();
    expect(drawnImage()).toBe(before);

    tokens['--text'] = '#222222';
    // The page of the test tells an observer of a style attribute that is set, not of one rewritten through `style`.
    page.document.documentElement.setAttribute('style', 'overflow: hidden; --palette-revision: 2');
    await nextPaint();
    await nextPaint();
    await nextPaint();
    expect(drawnImage()).toContain('--pele-fg:#222222;');
    expect(frames.size).toBe(0);
});

test('a diagram that is gone stops following the root', async () => {
    await drawDiagram();
    await act(async () => root.unmount());
    root = createRoot(page.host);
    const reads = tokenReads;
    tokens['--accent'] = '#ff6633';
    page.document.documentElement.style.setProperty('--palette-revision', '3');
    await nextPaint();
    expect(tokenReads).toBe(reads);
});

test('a text Pele cannot draw stays its source, with a note under it', async () => {
    await drawDiagram('graph TD\n  A-->');
    expect(page.host.querySelector('img')).toBeNull();
    expect(page.host.textContent).toContain('Could not show diagram. Showing its source.');
});
