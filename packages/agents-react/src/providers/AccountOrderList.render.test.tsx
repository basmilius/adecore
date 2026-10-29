import { describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createPage } from '@adecore/editor/testing';
import { movedIds, type AccountEntry } from '../agents/accounts';
import { AccountOrderList } from './AccountOrderList';

function entry(id: string, label: string, enabled = true): AccountEntry {
    return { id, account: { kind: 'claude', label, ...(enabled ? {} : { enabled: false }) }, status: null, isDefault: id === 'claude' };
}

async function render(
    entries: AccountEntry[],
    onReorder: ((ids: string[]) => void) | null
): Promise<{ host: HTMLElement; window: ReturnType<typeof createPage>['window']; done(): void }> {
    const page = createPage();
    const fromPage = ['window', 'document', 'Node', 'Element', 'HTMLElement'] as const;
    const names = [...fromPage, 'IS_REACT_ACT_ENVIRONMENT'] as const;
    const previous = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));

    for (const name of fromPage) {
        Object.defineProperty(globalThis, name, { value: name === 'window' ? page.window : page.window[name], configurable: true });
    }

    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    const root = createRoot(page.host);

    await act(async () =>
        root.render(<AccountOrderList entries={entries} providerName="Claude Code" login="terminal" onReorder={onReorder} onPickAccount={() => {}} />)
    );

    return {
        host: page.host,
        window: page.window,
        done: () => {
            act(() => root.unmount());

            for (const [index, name] of names.entries()) {
                const descriptor = previous[index];

                if (descriptor === undefined) {
                    Reflect.deleteProperty(globalThis, name);
                } else {
                    Object.defineProperty(globalThis, name, descriptor);
                }
            }
        }
    };
}

describe('the order of the accounts', () => {
    test('moves an id to another place', () => {
        expect(movedIds(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
        expect(movedIds(['a', 'b', 'c'], 'a', 9)).toEqual(['b', 'c', 'a']);
        expect(movedIds(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    });

    test('tags the top account that is on as the default, and Alt+Down moves the focused one', async () => {
        const reordered: string[][] = [];
        const view = await render([entry('claude_off', 'Off', false), entry('claude_work', 'Work'), entry('claude', 'Mine')], (ids) => reordered.push(ids));

        try {
            const rows = [...view.host.querySelectorAll('button')];
            expect(rows.map((row) => row.textContent?.includes('Default'))).toEqual([false, true, false]);
            expect(rows[1]?.getAttribute('aria-keyshortcuts')).toBe('Alt+ArrowUp Alt+ArrowDown');

            await act(async () => {
                rows[1]?.dispatchEvent(
                    Object.assign(new view.window.Event('keydown', { bubbles: true, cancelable: true }), { key: 'ArrowDown', altKey: true })
                );
            });

            await act(async () => {
                rows[0]?.dispatchEvent(Object.assign(new view.window.Event('keydown', { bubbles: true, cancelable: true }), { key: 'ArrowUp', altKey: true }));
                rows[2]?.dispatchEvent(Object.assign(new view.window.Event('keydown', { bubbles: true, cancelable: true }), { key: 'ArrowDown' }));
            });

            expect(reordered).toEqual([['claude_off', 'claude', 'claude_work']]);
        } finally {
            view.done();
        }
    });

    test('draws no handles and no default while the machine keeps no order or there is one account', async () => {
        const unordered = await render([entry('claude_work', 'Work'), entry('claude', 'Mine')], null);

        try {
            expect(unordered.host.querySelector('[draggable]')).toBeNull();
            expect(unordered.host.querySelector('button')?.hasAttribute('aria-keyshortcuts')).toBe(false);
        } finally {
            unordered.done();
        }

        const single = await render([entry('claude', 'Mine')], () => {});

        try {
            expect(single.host.querySelector('[draggable]')).toBeNull();
            expect(single.host.textContent).not.toContain('Default');
        } finally {
            single.done();
        }
    });
});
