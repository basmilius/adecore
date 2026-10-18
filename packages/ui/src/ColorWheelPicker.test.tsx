import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, useState, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { ColorWheelPicker, type ColorWheelPickerProps } from './ColorWheelPicker.tsx';
import { Select } from './Select.tsx';
import { UIProvider } from './UIProvider.tsx';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

type Tone = 'red' | 'amber' | 'green' | 'blue' | 'violet' | 'gray' | 'stone' | 'plain';

const NAMES: Record<Tone, string> = {
    red: 'Red',
    amber: 'Amber',
    green: 'Green',
    blue: 'Blue',
    violet: 'Violet',
    gray: 'Gray',
    stone: 'Stone',
    plain: 'Plain'
};

const base: ColorWheelPickerProps<Tone> = {
    label: 'Tint',
    value: 'green',
    onValueChange: () => {},
    rings: [
        ['red', 'amber', 'green', 'blue', 'violet'],
        ['gray', 'stone']
    ],
    center: 'plain',
    colorOf: (id) => `var(--tone-${id})`,
    labelOf: (id) => NAMES[id]
};

const render = (node: ReactNode): string => renderToStaticMarkup(<UIProvider i18n={i18n}>{node}</UIProvider>);
const classOf = (markup: string): string | undefined => /<button[^>]*class="([^"]+)"/.exec(markup)?.[1];

describe('a color wheel picker', () => {
    test('draws the trigger of an outlined select, with the swatch and the name of the color in use', () => {
        const markup = render(<ColorWheelPicker {...base} />);
        const select = render(<Select label="Tint" value="one" onValueChange={() => {}} items={[{ value: 'one', label: 'One' }]} />);
        expect(classOf(markup)).toBe(classOf(select)!);
        expect(markup).toContain('background:var(--tone-green)');
        expect(markup).toContain('>Green<');
        const labelledBy = /aria-labelledby="([^"]+)"/.exec(markup)?.[1]?.split(' ') ?? [];
        expect(labelledBy.map((id) => new RegExp(`id="${id}"[^>]*>([^<]+)<`).exec(markup)?.[1])).toEqual(['Tint', 'Green']);
    });

    test('takes a class for its trigger after its own', () => {
        expect(classOf(render(<ColorWheelPicker {...base} className="w-full" />))).toEndWith(' w-full');
    });
});

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/ui/src/ColorWheelPicker.test.tsx`.
describe.skipIf(typeof document === 'undefined')('a color wheel picker in a page', () => {
    let container: HTMLDivElement;
    let root: Root;
    let previews: (Tone | null)[];
    let picks: Tone[];

    function Harness(props: Partial<ColorWheelPickerProps<Tone>>) {
        const [value, setValue] = useState<Tone>(base.value);
        return (
            <UIProvider i18n={i18n}>
                <ColorWheelPicker<Tone>
                    {...base}
                    {...props}
                    value={value}
                    onValueChange={(id) => {
                        picks.push(id);
                        setValue(id);
                    }}
                    onPreviewChange={(id) => previews.push(id)}
                />
            </UIProvider>
        );
    }

    const settle = async (): Promise<void> => {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
        });
    };

    const trigger = (): HTMLButtonElement => container.querySelector<HTMLButtonElement>('button[aria-haspopup]')!;
    const swatch = (name: string): HTMLButtonElement | null =>
        document.querySelector<HTMLButtonElement>(`[role="radiogroup"][aria-label="Tint"] [aria-label="${name}"]`);
    const wheelLabel = (): string | null | undefined => document.querySelector('[role="radiogroup"]')?.nextElementSibling?.textContent;

    const open = async (): Promise<void> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(<Harness />));
        await act(async () => trigger().click());
        await settle();
    };

    const press = async (key: string): Promise<void> => {
        await act(async () => {
            (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        });
    };

    beforeEach(() => {
        previews = [];
        picks = [];
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    test('opens with the focus on the color in use, a ring a time from the outside in and the middle last', async () => {
        await open();
        expect(document.activeElement).toBe(swatch('Green'));
        const order = [...document.querySelectorAll('[role="radio"]')].map((radio) => radio.getAttribute('aria-label'));
        expect(order).toEqual(['Red', 'Amber', 'Green', 'Blue', 'Violet', 'Gray', 'Stone', 'Plain']);
        expect(swatch('Green')?.getAttribute('aria-checked')).toBe('true');
        expect([...document.querySelectorAll<HTMLElement>('[role="radio"]')].map((radio) => radio.tabIndex).filter((index) => index === 0)).toHaveLength(1);
        expect(swatch('Green')?.tabIndex).toBe(0);
        expect(swatch('Green')?.getAttribute('title')).toBeNull();
    });

    test('marks the color in use with its ring alone, no tick', async () => {
        await open();
        expect(swatch('Green')?.className).toContain('ring-2');
        expect(swatch('Green')?.querySelector('svg')).toBeNull();
    });

    test('places every swatch on whole pixels, the first of a ring at its top and the middle one in the middle', async () => {
        await open();
        const wheel = document.querySelector<HTMLElement>('[role="radiogroup"]')!;
        const size = Number.parseInt(wheel.style.width, 10);
        const spot = (name: string) => ({ left: swatch(name)!.style.left, top: swatch(name)!.style.top });
        for (const radio of document.querySelectorAll<HTMLElement>('[role="radio"]')) {
            expect(radio.style.left).toMatch(/^-?\d+px$/);
            expect(radio.style.top).toMatch(/^-?\d+px$/);
        }
        const middle = `${(size - 24) / 2}px`;
        expect(spot('Plain')).toEqual({ left: middle, top: middle });
        expect(spot('Red').left).toBe(middle);
        expect(spot('Gray').left).toBe(middle);
        expect(Number.parseInt(spot('Red').top, 10)).toBeLessThan(Number.parseInt(spot('Gray').top, 10));
    });

    test('previews the color with the focus or the pointer, says its name under the wheel, and ends the preview on closing without a pick', async () => {
        await open();
        expect(previews).toEqual(['green']);
        await act(async () => swatch('Blue')?.focus());
        expect(wheelLabel()).toBe('Blue');
        await act(async () => {
            swatch('Red')?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
            swatch('Red')?.dispatchEvent(new PointerEvent('pointerenter'));
        });
        expect(wheelLabel()).toBe('Red');
        await act(async () => {
            const wheel = document.querySelector('[role="radiogroup"]')!;
            wheel.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
            wheel.dispatchEvent(new PointerEvent('pointerleave'));
        });
        expect(wheelLabel()).toBe('Green');
        await press('Escape');
        await settle();
        expect(swatch('Blue')).toBeNull();
        expect(previews).toEqual(['green', 'blue', 'red', null, null]);
        expect(picks).toEqual([]);
        expect(trigger().textContent).toBe('Green');
    });

    test('ends the preview when it goes away while open', async () => {
        await open();
        await act(async () => swatch('Blue')?.focus());
        expect(previews.at(-1)).toBe('blue');
        await act(async () => root.unmount());
        expect(previews.at(-1)).toBeNull();
        // The shared cleanup unmounts once more; a second unmount of a root is a no-op.
    });

    test('walks the wheel with the arrows without picking', async () => {
        await open();
        await press('ArrowRight');
        expect(document.activeElement).toBe(swatch('Blue'));
        await press('End');
        expect(document.activeElement).toBe(swatch('Plain'));
        await press('ArrowDown');
        expect(document.activeElement).toBe(swatch('Red'));
        await press('ArrowLeft');
        expect(document.activeElement).toBe(swatch('Plain'));
        expect(swatch('Plain')?.tabIndex).toBe(0);
        expect(picks).toEqual([]);
    });

    test('picks with a click, closes and ends the preview after the pick', async () => {
        await open();
        await act(async () => swatch('Violet')?.click());
        await settle();
        expect(picks).toEqual(['violet']);
        expect(previews.at(-1)).toBeNull();
        expect(swatch('Violet')).toBeNull();
        expect(trigger().textContent).toBe('Violet');
    });
});
