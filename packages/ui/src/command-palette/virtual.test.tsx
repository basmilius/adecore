import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import i18next from 'i18next';
import { CommandPalette, UIProvider } from '../index.ts';

interface Item {
    label: string;
}

interface Group {
    label: string;
    items: Item[];
}

const GROUPS: Group[] = [
    { label: 'First group', items: Array.from({ length: 100 }, (_, index) => ({ label: `Item ${index}` })) },
    { label: 'Second group', items: [{ label: 'Needle' }] }
];

const heightOf = (element: HTMLElement): number => (element.getAttribute('role') === 'listbox' ? 256 : 32);

// The DOM runner has no layout engine; the list needs a viewport and measurable rows. The virtualizer
// measures its viewport by the client box and its rows by the offset box.
const SIZES: Record<string, (element: HTMLElement) => number> = {
    offsetHeight: heightOf,
    clientHeight: heightOf,
    offsetWidth: () => 576,
    clientWidth: () => 576
};

const i18n = i18next.createInstance();

await i18n.init({ lng: 'en', resources: {}, interpolation: { escapeValue: false } });

function Palette({ onPick }: { onPick(item: string): void }) {
    const [query, setQuery] = useState('');

    return (
        <CommandPalette.Root virtualized open items={GROUPS} itemToStringValue={(item: Item) => item.label} value={query} onValueChange={setQuery}>
            <CommandPalette.Popup>
                <CommandPalette.Input aria-label="Find an item" />
                <CommandPalette.Empty>No matching item</CommandPalette.Empty>
                <CommandPalette.VirtualList<Item, Group> groupLabel={(group) => group.label}>
                    {(item, itemProps) => (
                        <CommandPalette.Item {...itemProps} value={item} onClick={() => onPick(item.label)}>
                            {item.label}
                        </CommandPalette.Item>
                    )}
                </CommandPalette.VirtualList>
            </CommandPalette.Popup>
        </CommandPalette.Root>
    );
}

function type(input: HTMLInputElement, value: string): void {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
}

describe.skipIf(typeof document === 'undefined')('a virtual command palette', () => {
    let container: HTMLDivElement;
    let root: Root;
    let saved: Map<string, PropertyDescriptor | undefined>;

    beforeEach(() => {
        saved = new Map(Object.keys(SIZES).map((name) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)]));

        for (const [name, size] of Object.entries(SIZES)) {
            Object.defineProperty(HTMLElement.prototype, name, {
                configurable: true,
                get(this: HTMLElement) {
                    return size(this);
                }
            });
        }

        container = document.createElement('div');
        document.body.append(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();

        for (const [name, descriptor] of saved) {
            if (descriptor === undefined) {
                delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
            } else {
                Object.defineProperty(HTMLElement.prototype, name, descriptor);
            }
        }
    });

    test('bounds mounted options, preserves accessible totals and picks a result after filtering into another group', async () => {
        const picked: string[] = [];

        await act(async () =>
            root.render(
                <UIProvider i18n={i18n}>
                    <Palette onPick={(item) => picked.push(item)} />
                </UIProvider>
            )
        );

        const options = [...document.querySelectorAll('[role="option"]')];
        expect(options.length).toBeGreaterThan(0);
        expect(options.length).toBeLessThan(101);
        expect(options[0]!.getAttribute('aria-setsize')).toBe('101');
        expect(options[0]!.getAttribute('aria-posinset')).toBe('1');
        const input = document.querySelector<HTMLInputElement>('input[role="combobox"]')!;
        await act(async () => type(input, 'needle'));
        const remaining = [...document.querySelectorAll('[role="option"]')];
        expect(remaining.map((row) => row.textContent)).toEqual(['Needle']);
        expect(remaining[0]!.getAttribute('aria-setsize')).toBe('1');
        expect(remaining[0]!.getAttribute('aria-posinset')).toBe('1');
        expect(document.querySelector('[role="group"]')?.textContent).toContain('Second group');
        await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
        expect(picked).toEqual(['Needle']);
        await act(async () => type(input, 'absent'));
        expect(document.querySelectorAll('[role="option"]')).toHaveLength(0);
        expect(document.body.textContent).toContain('No matching item');
    });
});
