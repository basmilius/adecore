import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, useState, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { Bug, Cloud, GitBranch, Rocket, Server } from 'lucide-react';
import { setFormatSource, type FormatSource } from './format/locale.ts';
import { IconPicker, type IconPickerGroup, type IconPickerProps } from './IconPicker.tsx';
import { fakeFormatSource } from './testing/fake-source.ts';
import { UIProvider } from './UIProvider.tsx';

const i18n = i18next.createInstance();

await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const GROUPS: IconPickerGroup[] = [
    { id: 'code', label: 'Code', icons: { 'git-branch': GitBranch, bug: Bug } },
    { id: 'infra', label: 'Infrastructure', icons: { server: Server, cloud: Cloud, rocket: Rocket } }
];

let previousFormatSource: FormatSource;

beforeEach(() => {
    previousFormatSource = setFormatSource(fakeFormatSource());
});

afterEach(() => {
    setFormatSource(previousFormatSource);
});

const render = (node: ReactNode): string => renderToStaticMarkup(<UIProvider i18n={i18n}>{node}</UIProvider>);

describe('an icon picker', () => {
    test('offers to clear a chosen icon beside the trigger, and nothing to clear while there is none', () => {
        const chosen = render(<IconPicker icons={GROUPS} value="cloud" onValueChange={() => {}} onClear={() => {}} />);
        expect(chosen).toContain('aria-label="No icon"');
        const none = render(<IconPicker icons={GROUPS} value={null} onValueChange={() => {}} onClear={() => {}} />);
        expect(none).not.toContain('aria-label="No icon"');
    });

    test('keeps a hidden label as the name of its trigger', () => {
        const markup = render(<IconPicker icons={GROUPS} value={null} label="Symbol" hideLabel onValueChange={() => {}} />);
        expect(markup).toMatch(/<div id="[^"]+" class="[^"]*sr-only[^"]*"[^>]*>Symbol<\/div>/);
    });

    test('is a trigger drawn like a field under its label, naming the chosen icon', () => {
        const markup = render(<IconPicker icons={GROUPS} value="cloud" label="Symbol" onValueChange={() => {}} />);
        const labelId = /<div id="([^"]+)"[^>]*>Symbol<\/div>/.exec(markup)?.[1];
        const valueId = /<span id="([^"]+)"[^>]*>cloud<\/span>/.exec(markup)?.[1];
        expect(labelId).toBeDefined();
        expect(markup).toContain(`aria-labelledby="${labelId} ${valueId}"`);
        expect(markup).toMatch(/<button[^>]*class="field /);
        expect(markup).toContain('aria-haspopup="dialog"');
        expect(markup).not.toContain('role="radiogroup"');
    });

    test('says none while no icon is chosen', () => {
        const markup = render(<IconPicker icons={GROUPS} value={null} onValueChange={() => {}} />);
        expect(markup).toContain('>Icon</div>');
        expect(markup).toMatch(/<span id="[^"]+" class="[^"]*text-text-faint[^"]*">None<\/span>/);
    });

    test('cannot open while disabled', () => {
        expect(render(<IconPicker icons={GROUPS} value={null} disabled onValueChange={() => {}} />)).toMatch(/<button[^>]*disabled=""/);
    });
});

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/ui/src/IconPicker.test.tsx`.
describe.skipIf(typeof document === 'undefined')('an icon picker in a page', () => {
    let container: HTMLDivElement;
    let root: Root;
    let picks: string[];
    let clears: number;

    function Harness({ initial, ...props }: Partial<IconPickerProps> & { initial: string | null }) {
        const [value, setValue] = useState<string | null>(initial);

        return (
            <UIProvider i18n={i18n}>
                <IconPicker
                    icons={GROUPS}
                    {...props}
                    value={value}
                    onValueChange={(name) => {
                        picks.push(name);
                        setValue(name);
                    }}
                    onClear={() => {
                        clears += 1;
                        setValue(null);
                    }}
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

    const cell = (name: string): HTMLButtonElement | null => document.querySelector<HTMLButtonElement>(`[role="radio"][aria-label="${name}"]`);

    const search = (): HTMLInputElement | null => document.querySelector<HTMLInputElement>('input[aria-label="Search icons"]');

    const open = async (props: Partial<IconPickerProps> & { initial: string | null }): Promise<void> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(<Harness {...props} />));
        await act(async () => trigger().click());
        await settle();
    };

    const press = async (key: string): Promise<void> => {
        await act(async () => {
            (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        });

        await settle();
    };

    const type = async (text: string): Promise<void> => {
        await act(async () => {
            const input = search()!;
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, text);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    };

    beforeEach(() => {
        picks = [];
        clears = 0;
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    test('opens a popover with the search focused over the groups, each under a heading with its count', async () => {
        await open({ initial: 'cloud', rows: 7 });
        expect(trigger().getAttribute('aria-expanded')).toBe('true');
        expect(document.activeElement).toBe(search());
        const headings = [...document.querySelectorAll<HTMLElement>('[data-icon-heading]')];
        expect(headings.map((heading) => heading.textContent)).toEqual(['Code2', 'Infrastructure3']);
        expect(headings[0]?.className).toContain('dark:bg-surface-hover');
        expect(document.querySelector<HTMLElement>('[role="radiogroup"]')?.style.height).toBe('256px');
        expect([...document.querySelectorAll<HTMLElement>('[role="radio"]')].filter((radio) => radio.tabIndex === 0)).toEqual([cell('cloud')!]);
    });

    test('opens on the chosen icon for a flat set, without a search, and walks it with the arrows without choosing', async () => {
        await open({ initial: 'bug', icons: { rocket: Rocket, bug: Bug, cloud: Cloud }, rows: 2 });
        expect(search()).toBeNull();
        expect(document.activeElement).toBe(cell('bug'));
        expect(document.querySelector<HTMLElement>('[role="radiogroup"]')?.style.height).toBe('74px');
        await press('ArrowRight');
        expect(document.activeElement).toBe(cell('cloud'));
        await press('Home');
        expect(document.activeElement).toBe(cell('rocket'));
        expect(picks).toEqual([]);
    });

    test('chooses with a click, closes and hands the focus back to the trigger', async () => {
        await open({ initial: 'cloud' });
        await act(async () => cell('server')?.click());
        await settle();
        expect(picks).toEqual(['server']);
        expect(cell('server')).toBeNull();
        expect(document.activeElement).toBe(trigger());
        expect(trigger().textContent).toBe('server');
    });

    test('narrows the grid as a person types and says when nothing matches', async () => {
        await open({ initial: null, keywords: { server: ['backend'] } });
        await type('back');
        expect([...document.querySelectorAll('[role="radio"]')].map((radio) => radio.getAttribute('aria-label'))).toEqual(['server']);
        await type('nothing');
        expect(document.body.textContent).toContain('No icon matches “nothing”');
    });

    test('empties the search on the first Escape and closes on the next', async () => {
        await open({ initial: 'cloud' });
        await type('bu');
        await press('Escape');
        expect(search()?.value).toBe('');
        expect(document.activeElement).toBe(search());
        expect(trigger().getAttribute('aria-expanded')).toBe('true');
        await press('Escape');
        expect(search()).toBeNull();
        expect(document.activeElement).toBe(trigger());
        expect(picks).toEqual([]);
    });

    test('clears the icon from inside the popover and closes', async () => {
        await open({ initial: 'cloud' });
        const none = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'No icon')!;
        await act(async () => none.click());
        await settle();
        expect(clears).toBe(1);
        expect(trigger().textContent).toBe('None');
        await act(async () => trigger().click());
        await settle();
        expect([...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'No icon')?.disabled).toBe(true);
    });
});
