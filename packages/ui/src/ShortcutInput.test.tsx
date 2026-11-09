import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { isApplePlatform } from './platform.ts';
import { shortcut, type Shortcut } from './shortcut.ts';
import { ShortcutInput, type ShortcutInputProps } from './ShortcutInput.tsx';

const PALETTE = shortcut('Mod+K');

describe('a shortcut input', () => {
    test('is a button that prints the shortcut key by key and names it after its label', () => {
        const markup = renderToStaticMarkup(<ShortcutInput value={shortcut('Mod+Shift+P')} onChange={() => {}} label="Shortcut for Open palette" />);
        expect(markup).toMatch(/^<button type="button"/);
        expect(markup).toMatch(/aria-label="Shortcut for Open palette: [^"]*P"/);
        expect(markup.match(/<kbd/g)).toHaveLength(3);
        expect(markup).not.toContain('Press a shortcut');
    });

    test('can be disabled', () => {
        const markup = renderToStaticMarkup(<ShortcutInput value={PALETTE} onChange={() => {}} label="Shortcut" disabled />);
        expect(markup).toContain('disabled=""');
    });
});

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/ui/src/ShortcutInput.test.tsx`.
describe.skipIf(typeof document === 'undefined')('a shortcut input under the keyboard', () => {
    let container: HTMLDivElement;
    let root: Root;
    let changes: Shortcut[];
    let recording: boolean[];
    let seenByPage: string[];

    const listen = (event: Event): void => {
        seenByPage.push((event as KeyboardEvent).key);
    };

    const mount = async (props: Partial<ShortcutInputProps> = {}): Promise<HTMLButtonElement> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(wrap(props)));

        return container.querySelector('button')!;
    };

    const wrap = (props: Partial<ShortcutInputProps>): ReactNode => (
        <ShortcutInput
            value={PALETTE}
            label="Shortcut for Open palette"
            onChange={(next) => changes.push(next)}
            onRecordingChange={(next) => recording.push(next)}
            labels={{ prompt: 'Press a shortcut', unsupported: 'Not a shortcut' }}
            {...props}
        />
    );

    // The modifier of the platform the component prints for, as a user on it would hold.
    const mod = (): { metaKey: boolean } | { ctrlKey: boolean } => (isApplePlatform() ? { metaKey: true } : { ctrlKey: true });

    const press = async (init: KeyboardEventInit): Promise<KeyboardEvent> => {
        const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });

        await act(async () => {
            (document.activeElement ?? document.body).dispatchEvent(event);
        });

        return event;
    };

    const status = (): string => container.querySelector('[aria-live]')?.textContent ?? '';

    const start = async (button: HTMLButtonElement): Promise<void> => {
        button.focus();
        await act(async () => button.click());
    };

    beforeEach(() => {
        changes = [];
        recording = [];
        seenByPage = [];
        container = document.createElement('div');
        document.body.append(container);
        window.addEventListener('keydown', listen);
    });

    afterEach(async () => {
        window.removeEventListener('keydown', listen);
        await act(async () => root.unmount());
        container.remove();
    });

    test('waits for a key once it is pressed, and says so', async () => {
        const button = await mount();
        expect(status()).toBe('');
        await start(button);
        expect(status()).toBe('Press a shortcut');
        expect(recording).toEqual([true]);
    });

    test('takes the first shortcut it is given, ends recording and prints the value it is handed', async () => {
        const button = await mount();
        await start(button);
        await press({ key: 'p', code: 'KeyP', shiftKey: true, ...mod() });
        expect(changes).toEqual([shortcut('Mod+Shift+P')]);
        expect(status()).toBe('');
        expect(recording).toEqual([true, false]);

        const root2 = root;
        await act(async () => root2.render(wrap({ value: changes[0]! })));
        expect(button.querySelectorAll('kbd')).toHaveLength(3);
    });

    test('keeps every key from the page while it records, a shortcut of the page included', async () => {
        const button = await mount();
        await start(button);
        const event = await press({ key: 'k', code: 'KeyK', ...mod() });
        expect(event.defaultPrevented).toBe(true);
        expect(seenByPage).toEqual([]);

        const after = await press({ key: 'k', code: 'KeyK', ...mod() });
        expect(after.defaultPrevented).toBe(false);
        expect(seenByPage).toEqual(['k']);
    });

    test('waits through a modifier on its own', async () => {
        const button = await mount();
        await start(button);
        await press({ key: 'Shift', code: 'ShiftLeft', shiftKey: true });
        await press({ key: 'Meta', code: 'MetaLeft', metaKey: true });
        expect(changes).toEqual([]);
        expect(status()).toBe('Press a shortcut');
    });

    test('ends recording on Escape without a change, and ignores a bare Backspace', async () => {
        const button = await mount();
        await start(button);
        await press({ key: 'Backspace', code: 'Backspace' });
        expect(status()).toBe('Press a shortcut');
        expect(changes).toEqual([]);
        await press({ key: 'Escape', code: 'Escape' });
        expect(status()).toBe('');
        expect(changes).toEqual([]);
        expect(recording).toEqual([true, false]);
    });

    test('takes Escape and Backspace with a modifier as keys', async () => {
        const button = await mount();
        await start(button);
        await press({ key: 'Backspace', code: 'Backspace', ...mod() });
        expect(changes).toEqual([shortcut('Mod+Backspace')]);
        await start(button);
        await press({ key: 'Escape', code: 'Escape', altKey: true });
        expect(changes).toEqual([shortcut('Mod+Backspace'), shortcut('Alt+Escape')]);
    });

    test('shows the reason validate gives, goes on recording and takes the next key that passes', async () => {
        const refused: Shortcut[] = [];
        const button = await mount({
            validate: (next) => {
                refused.push(next);

                return next.mod || next.alt ? null : 'Needs Cmd, Ctrl or Alt';
            }
        });
        await start(button);
        await press({ key: 'k', code: 'KeyK' });
        expect(status()).toBe('Needs Cmd, Ctrl or Alt');
        expect(changes).toEqual([]);
        await press({ key: 'k', code: 'KeyK', altKey: true });
        expect(changes).toEqual([shortcut('Alt+K')]);
        expect(refused).toEqual([shortcut('K'), shortcut('Alt+K')]);
        expect(status()).toBe('');
    });

    test('refuses a key shortcut() cannot write with its own words', async () => {
        const button = await mount();
        await start(button);
        await press({ key: '1', code: 'Numpad1', ...mod() });
        expect(status()).toBe('Not a shortcut');
        expect(changes).toEqual([]);
        await press({ key: 'F13', code: 'F13', ...mod() });
        expect(status()).toBe('Not a shortcut');
    });

    test('ends recording when focus leaves, and when the button is pressed again', async () => {
        const button = await mount();
        await start(button);
        await act(async () => button.blur());
        expect(status()).toBe('');
        await start(button);
        await act(async () => button.click());
        expect(status()).toBe('');
        expect(recording).toEqual([true, false, true, false]);
    });

    test('reports the end of recording when it goes away while recording', async () => {
        const button = await mount();
        await start(button);
        const mounted = root;
        await act(async () => mounted.unmount());
        expect(recording).toEqual([true, false]);
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
    });
});
