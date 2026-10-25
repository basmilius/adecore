import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ChatAttachment, ChatToolItem, ChatVisual } from '@adecore/agent-contracts';
import { createPage } from '@adecore/editor/testing';
import { Menu } from '@adecore/ui';
import { ChatHostProvider, type ChatHost, type HostMenuAction } from '../../host';
import { ChatScopeContext, type ChatScope } from '../../scope';
import { GeneratedImageRow } from './rows/GeneratedImageRow';
import { VisualRow } from './rows/VisualRow';
import { VisualPageFrame } from './VisualFrame';

const scope = {
    id: 'host-actions-test',
    keyOf: (chatId: string) => `host-actions-test/${chatId}`,
    owns: (key: string) => key.startsWith('host-actions-test/')
} as unknown as ChatScope;

const visual: ChatVisual = { id: 'visual', title: 'Revenue', at: 1, maxHeight: 600, size: 10 };

const attachment: ChatAttachment = { id: 'image', name: 'cat.png', mime: 'image/png', size: 100, path: '/images/cat.png', width: 10, height: 10 };

const imageTool = {
    id: 'tool',
    kind: 'tool',
    createdAt: 1,
    turnId: 'turn',
    toolUseId: 'call',
    name: 'ImageGeneration',
    state: 'done',
    input: { attachment },
    output: null
} as unknown as ChatToolItem;

const FROM_PAGE = ['window', 'document', 'Node', 'Element', 'HTMLElement', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const;
const NAMES = [...FROM_PAGE, 'ResizeObserver', 'IS_REACT_ACT_ENVIRONMENT'] as const;

class StillResizeObserver {
    observe(): void {}
    disconnect(): void {}
}

let page: ReturnType<typeof createPage>;
let root: Root;
let previous: (PropertyDescriptor | undefined)[];
const drawnMenus: Root[] = [];

beforeEach(() => {
    page = createPage();
    previous = NAMES.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperties((page.window as unknown as { HTMLElement: { prototype: object } }).HTMLElement.prototype, {
        clientWidth: { get: () => 640, configurable: true },
        clientHeight: { get: () => 240, configurable: true }
    });
    // A page without styles: every token and background reads as unset.
    page.window.getComputedStyle = () =>
        new Proxy(
            { getPropertyValue: () => '' },
            { get: (target, key) => (key in target ? target[key as 'getPropertyValue'] : '') }
        ) as unknown as CSSStyleDeclaration;
    page.window.requestAnimationFrame = () => 0;
    page.window.cancelAnimationFrame = () => {};
    for (const name of FROM_PAGE) {
        Object.defineProperty(globalThis, name, { value: name === 'window' ? page.window : page.window[name], configurable: true });
    }
    Object.defineProperty(globalThis, 'ResizeObserver', { value: StillResizeObserver, configurable: true });
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    root = createRoot(page.host);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
        drawnMenus.splice(0).forEach((drawn) => drawn.unmount());
    });
    NAMES.forEach((name, index) => {
        const descriptor = previous[index];
        if (descriptor === undefined) {
            Reflect.deleteProperty(globalThis, name);
        } else {
            Object.defineProperty(globalThis, name, descriptor);
        }
    });
});

async function render(host: Partial<ChatHost>, children: ReactNode): Promise<void> {
    await act(async () =>
        root.render(
            <ChatHostProvider host={host}>
                <ChatScopeContext.Provider value={scope}>{children}</ChatScopeContext.Provider>
            </ChatHostProvider>
        )
    );
}

interface Fiber {
    type: unknown;
    memoizedProps: Record<string, unknown> | null;
    child: Fiber | null;
    sibling: Fiber | null;
}

function propsOf(name: string): Record<string, unknown> | null {
    const key = Object.keys(page.host).find((entry) => entry.startsWith('__reactContainer$'))!;
    const find = (fiber: Fiber | null): Fiber | null => {
        for (let node = fiber; node !== null; node = node.sibling) {
            const found = typeof node.type === 'function' && (node.type as { name: string }).name === name ? node : find(node.child);
            if (found !== null) {
                return found;
            }
        }
        return null;
    };
    const container = (page.host as unknown as Record<string, { stateNode: { current: Fiber } }>)[key]!;
    return find(container.stateNode.current.child)?.memoizedProps ?? null;
}

/* The items of the row's menu, drawn as its open popup would draw them; a closed menu has no popup in a page without pointer events. */
async function menuItems(): Promise<HTMLElement[]> {
    const popup = propsOf('MenuPopup') as { children: ReactNode } | null;
    expect(popup).not.toBeNull();
    const container = page.document.createElement('div');
    page.document.body.appendChild(container);
    const drawn = createRoot(container);
    await act(async () => drawn.render(<Menu.Root>{popup!.children}</Menu.Root>));
    drawnMenus.push(drawn);
    return [...container.querySelectorAll<HTMLElement>('[role="menuitem"]')];
}

const labelsOf = (items: HTMLElement[]): (string | undefined)[] => items.map((item) => item.textContent?.trim());

const visuals = { frameUrl: 'https://visuals.example.test/frame.html', openLink: () => {} };

test("a visual's menu offers the host's actions above Remove and runs the one a person picks", async () => {
    const asked: [string, string, string][] = [];
    const ran: string[] = [];
    const actions = (scopeId: string, chatId: string, shown: ChatVisual): HostMenuAction[] => {
        asked.push([scopeId, chatId, shown.id]);
        return [{ id: 'keep', label: 'Keep', run: () => ran.push('keep') }];
    };
    await render({ visuals: { ...visuals, actions } }, <VisualRow chatId="chat" visual={visual} />);
    const items = await menuItems();
    expect(labelsOf(items)).toEqual(['Keep', 'Remove visual']);
    expect(asked).toContainEqual(['host-actions-test', 'chat', 'visual']);
    await act(async () => items[0]!.click());
    expect(ran).toEqual(['keep']);
});

test("a visual's menu holds Remove alone when the host adds nothing", async () => {
    await render({ visuals }, <VisualRow chatId="chat" visual={visual} />);
    expect(labelsOf(await menuItems())).toEqual(['Remove visual']);
});

test('a generated image without a prompt gets a menu for the actions of the host', async () => {
    const ran: string[] = [];
    const host: Partial<ChatHost> = {
        attachments: {
            useUrl: () => ({ url: 'blob:image', failure: null }),
            read: async () => new Blob(),
            actions: (_scopeId, _chatId, shown) => [{ id: 'keep', label: `Keep ${shown.name}`, run: () => ran.push(shown.id) }]
        }
    };
    await render(host, <GeneratedImageRow chatId="chat" tool={imageTool} />);
    expect(page.document.querySelector('[aria-label="More actions"]')).not.toBeNull();
    const items = await menuItems();
    expect(labelsOf(items)).toEqual(['Keep cat.png']);
    await act(async () => items[0]!.click());
    expect(ran).toEqual(['image']);
});

test('a generated image without a prompt or actions of the host has no menu', async () => {
    await render(
        { attachments: { useUrl: () => ({ url: 'blob:image', failure: null }), read: async () => new Blob() } },
        <GeneratedImageRow chatId="chat" tool={imageTool} />
    );
    expect(page.document.querySelector('[aria-label="More actions"]')).toBeNull();
});

test('a page outside a thread opens in the sandboxed frame of the host and is read once it opens', async () => {
    let reads = 0;
    const read = async (): Promise<string> => {
        reads += 1;
        return '<p>Saved</p>';
    };
    await render({ visuals }, <VisualPageFrame page={read} title="Saved page" />);
    const frame = page.document.querySelector('iframe');
    expect(frame?.getAttribute('sandbox')).toBe('allow-scripts allow-forms');
    expect(frame?.getAttribute('title')).toBe('Saved page');
    expect(frame?.getAttribute('src')?.startsWith(`${visuals.frameUrl}#`)).toBe(true);
    expect(reads).toBe(1);
});

test('a page outside a thread draws no frame while the host has no visuals', async () => {
    await render({}, <VisualPageFrame page={async () => ''} title="Saved page" />);
    expect(page.document.querySelector('iframe')).toBeNull();
});
