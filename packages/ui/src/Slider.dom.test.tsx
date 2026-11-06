import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import i18next from 'i18next';
import { act, useState, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { setFormatSource, type FormatSource } from './format/locale.ts';
import { Slider, type SliderProps } from './Slider.tsx';
import { fakeFormatSource } from './testing/fake-source.ts';
import { UIProvider } from './UIProvider.tsx';

const i18n = i18next.createInstance();

await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

let previousFormatSource: FormatSource;

beforeEach(() => {
    previousFormatSource = setFormatSource(fakeFormatSource());
});

afterEach(() => {
    setFormatSource(previousFormatSource);
});

describe('a slider under the keyboard', () => {
    let container: HTMLDivElement;
    let changes: number[];
    let root: Root;

    function Harness(props: Omit<SliderProps, 'value' | 'onValueChange' | 'label'> & { initial: number }) {
        const { initial, ...rest } = props;
        const [value, setValue] = useState(initial);

        return (
            <Slider
                {...rest}
                label="Agents"
                value={value}
                onValueChange={(next) => {
                    changes.push(next);
                    setValue(next);
                }}
            />
        );
    }

    const mount = async (node: ReactNode): Promise<HTMLInputElement> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);

        await act(async () => {
            root.render(<UIProvider i18n={i18n}>{node}</UIProvider>);
        });

        const input = container.querySelector<HTMLInputElement>('input[type="range"]');

        if (input === null) {
            throw new Error('no range input');
        }

        return input;
    };

    const press = async (input: HTMLInputElement, key: string): Promise<void> => {
        await act(async () => {
            input.focus();
            const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
            // Base UI 1.0.0-rc.0 reads the global `window.event` while it sets a value; Chromium has one, happy-dom none.
            Object.assign(globalThis, { event });

            try {
                input.dispatchEvent(event);
            } finally {
                Reflect.deleteProperty(globalThis, 'event');
            }
        });
    };

    beforeEach(() => {
        changes = [];
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    test('steps with the arrows, jumps a tenth of the range with Page Up and stops at the ends', async () => {
        const input = await mount(<Harness initial={8} min={0} max={20} />);
        await press(input, 'ArrowRight');
        await press(input, 'ArrowLeft');
        await press(input, 'ArrowLeft');
        await press(input, 'PageUp');
        await press(input, 'End');
        await press(input, 'ArrowRight');
        await press(input, 'Home');
        expect(changes).toEqual([9, 8, 7, 9, 20, 0]);
        expect(input.getAttribute('aria-valuetext')).toBe('0');
    });

    test('lands on a decimal step without drift', async () => {
        const input = await mount(<Harness initial={0.2} min={0} max={1} step={0.1} />);
        await press(input, 'ArrowRight');
        await press(input, 'ArrowRight');
        expect(changes).toEqual([0.3, 0.4]);
        expect(input.getAttribute('aria-valuetext')).toBe('0.4');
    });

    test('takes its input out of the tab order when disabled', async () => {
        const input = await mount(<Harness initial={8} min={0} max={20} disabled />);
        expect(input.disabled).toBe(true);
    });
});
