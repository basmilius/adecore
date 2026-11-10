import { describe, expect, test } from 'bun:test';
import i18next from 'i18next';
import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
