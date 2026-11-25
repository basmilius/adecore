import { afterEach, describe, expect, test } from 'bun:test';
import i18next from 'i18next';
import { Play } from 'lucide-react';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Select } from './Select.tsx';
import { UIProvider } from './UIProvider.tsx';

const i18n = i18next.createInstance();

await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

describe('a select whose rows carry an action', () => {
    let container: HTMLDivElement;
    let root: Root;
    let tried: string[];
    let picked: string[];

    function Harness({ searchable }: { searchable?: boolean }) {
        const [value, setValue] = useState('bar');

        return (
            <UIProvider i18n={i18n}>
                <Select
                    label="Pack"
                    searchable={searchable}
                    value={value}
                    onValueChange={(next) => {
                        picked.push(next);
                        setValue(next);
                    }}
                    items={[
                        { value: 'none', label: 'none', separatorAfter: true },
                        ...['bar', 'glass'].map((pack) => ({
                            value: pack,
                            label: pack,
                            action: { icon: Play, label: `Play ${pack}`, run: () => void tried.push(pack) }
                        }))
                    ]}
                />
            </UIProvider>
        );
    }

    const settle = async (): Promise<void> => {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
        });
    };

    const open = async (searchable: boolean): Promise<void> => {
        tried = [];
        picked = [];
        container = document.createElement('div');
        document.body.append(container);
        root = createRoot(container);
        await act(async () => root.render(<Harness searchable={searchable} />));
        await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Pack"]')!.click());
        await settle();
    };

    const press = async (element: HTMLElement): Promise<void> => {
        await act(async () => {
            element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
            element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            element.click();
        });
        await settle();
    };

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    test.each([
        ['plain', false],
        ['searchable', true]
    ])('the action of a %s row runs without picking the option or closing the list', async (_kind, searchable) => {
        await open(searchable);
        await press(document.querySelector<HTMLButtonElement>('button[aria-label="Play glass"]')!);

        expect(tried).toEqual(['glass']);
        expect(picked).toEqual([]);
        expect(document.querySelector('button[aria-label="Play bar"]')).not.toBeNull();
    });

    test('a press on the row itself still picks the option', async () => {
        await open(false);
        await press([...document.querySelectorAll<HTMLElement>('[role="option"]')].at(-1)!);

        expect(picked).toEqual(['glass']);
        expect(tried).toEqual([]);
    });

    test('a row that stands apart has a line under it, and only that row', async () => {
        await open(false);

        const separators = [...document.querySelectorAll('[role="separator"]')];

        expect(separators).toHaveLength(1);
        expect(separators[0]!.previousElementSibling?.textContent).toBe('none');
    });
});
