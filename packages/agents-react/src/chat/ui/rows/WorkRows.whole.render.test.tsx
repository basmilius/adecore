import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ChatCheckpointDiff, ChatToolItem } from '@adecore/agent-contracts';
import { createPage } from '@adecore/editor/testing';
import { ChatHostProvider, type ChatActions, type ChatHost } from '../../../host';
import { ChatScopeContext, type ChatScope } from '../../../scope';
import { ChangedFilesRow, ToolBody } from './WorkRows';

const scope = {
    id: 'whole-test',
    keyOf: (chatId: string) => `whole-test/${chatId}`,
    owns: (key: string) => key.startsWith('whole-test/')
} as unknown as ChatScope;

const PREVIEW = 'first line of the build\n';
const WHOLE = `${PREVIEW}and the line the thread did not keep\n`;

const stored: ChatToolItem = {
    id: 'tool',
    kind: 'tool',
    createdAt: 1,
    turnId: 'turn',
    toolUseId: 'call',
    name: 'Bash',
    input: { command: 'make' },
    output: PREVIEW,
    state: 'done',
    parentToolUseId: null,
    outputRef: { id: 'a'.repeat(64), bytes: 3 * 1024 * 1024 }
};

const NAMES = ['window', 'document', 'Node', 'Element', 'HTMLElement', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const;

let page: ReturnType<typeof createPage>;
let root: Root;
let previous: (PropertyDescriptor | undefined)[];

beforeEach(() => {
    page = createPage();
    previous = [...NAMES, 'IS_REACT_ACT_ENVIRONMENT'].map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
    page.window.requestAnimationFrame = () => 0;
    page.window.cancelAnimationFrame = () => {};

    for (const name of NAMES) {
        Object.defineProperty(globalThis, name, { value: name === 'window' ? page.window : page.window[name], configurable: true });
    }

    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    root = createRoot(page.host);
});

afterEach(async () => {
    await act(async () => root.unmount());

    [...NAMES, 'IS_REACT_ACT_ENVIRONMENT'].forEach((name, index) => {
        const descriptor = previous[index];

        if (descriptor === undefined) {
            Reflect.deleteProperty(globalThis, name);
        } else {
            Object.defineProperty(globalThis, name, descriptor);
        }
    });
});

async function render(actions: Partial<ChatActions>, children: ReactNode): Promise<void> {
    const host: Partial<ChatHost> = { actions: actions as ChatActions };

    await act(async () =>
        root.render(
            <ChatHostProvider host={host}>
                <ChatScopeContext.Provider value={scope}>{children}</ChatScopeContext.Provider>
            </ChatHostProvider>
        )
    );
}

function button(label: string): HTMLButtonElement | null {
    return [...page.host.querySelectorAll('button')].find((element) => element.textContent?.trim() === label) ?? null;
}

async function click(label: string): Promise<void> {
    await act(async () => button(label)?.click());
}

test('a stored output shows its beginning and size, and the whole once a person asks', async () => {
    const asked: [string, string][] = [];

    await render(
        {
            toolOutput: async (chatId, itemId) => {
                asked.push([chatId, itemId]);

                return WHOLE;
            }
        },
        <ToolBody tool={stored} chatId="chat" />
    );

    expect(page.host.textContent).toContain(PREVIEW.trim());
    expect(page.host.textContent).not.toContain('did not keep');
    expect(page.host.textContent).toContain('3 MB in total');
    expect(page.host.textContent).not.toContain('more character');
    await click('Show full output');
    expect(asked).toEqual([['chat', 'tool']]);
    expect(page.host.textContent).toContain('did not keep');
    expect(button('Show full output')).toBeNull();
});

test('a failed load says so and loads again on a retry', async () => {
    let calls = 0;

    await render(
        {
            toolOutput: async () => {
                calls += 1;

                if (calls === 1) {
                    throw new Error('gone');
                }

                return WHOLE;
            }
        },
        <ToolBody tool={stored} chatId="chat" />
    );

    await click('Show full output');
    expect(page.host.textContent).toContain('Could not load the full output');
    await click('Try again');
    expect(page.host.textContent).toContain('did not keep');
});

test('without a host that answers the whole, the beginning is all there is', async () => {
    await render({}, <ToolBody tool={stored} chatId="chat" />);
    expect(page.host.textContent).toContain(PREVIEW.trim());
    expect(button('Show full output')).toBeNull();
});

test('an output past the clip shows the rest in place, without asking the host', async () => {
    const long = `${'x'.repeat(5000)}END`;
    await render({}, <ToolBody tool={{ ...stored, output: long, outputRef: undefined }} chatId="chat" />);
    expect(page.host.textContent).not.toContain('END');
    await click('Show full output');
    expect(page.host.textContent).toContain('END');
});

test('a file whose diff the thread held back loads the whole diff of its turn', async () => {
    const preview: ChatCheckpointDiff = {
        files: [
            { path: 'a.ts', kind: 'update', added: 1, deleted: 0, diff: '@@ -1 +1 @@\n+kept\n' },
            { path: 'b.ts', kind: 'update', added: 1, deleted: 0, diff: '' }
        ],
        truncated: false
    };

    const asked: string[] = [];

    await render(
        {
            turnDiff: async (_chatId, turnId) => {
                asked.push(turnId);

                return { ...preview, files: preview.files.map((file) => ({ ...file, diff: file.diff || '@@ -1 +1 @@\n+loaded\n' })) };
            }
        },
        <ChangedFilesRow chatId="chat" turnId="turn" tools={[]} diff={preview} checkpoint heldBack />
    );

    await act(async () => page.host.querySelector<HTMLButtonElement>('button[aria-expanded]')?.click());
    await act(async () => page.host.querySelector<HTMLButtonElement>('[data-file-path="b.ts"]')?.click());
    await click('Show full diff');
    expect(asked).toEqual(['turn']);
    expect(button('Show full diff')).toBeNull();
});
