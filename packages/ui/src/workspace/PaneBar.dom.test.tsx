import { afterEach, describe, expect, test } from 'bun:test';
import i18next from 'i18next';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UIProvider } from '../UIProvider.tsx';
import { PaneBar } from './PaneBar.tsx';

const i18n = i18next.createInstance();

await i18n.init({ lng: 'en', resources: {}, interpolation: { escapeValue: false } });

let root: Root | null = null;

async function draw(count: number): Promise<HTMLElement> {
    const host = document.createElement('div');

    document.body.append(host);
    root ??= createRoot(host);

    const actions = Array.from({ length: count }, (_, index) => (
        <button key={index} type="button">
            Action {index}
        </button>
    ));

    await act(async () => {
        root!.render(
            <UIProvider i18n={i18n}>
                <PaneBar title="Tabs" tabs actions={actions} onClose={() => undefined} closeLabel="Close cell" />
            </UIProvider>
        );
    });

    return document.body;
}

afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.replaceChildren();
});

describe('PaneBar with tabs', () => {
    test('keeps two controls and an overflow menu in the row of the tabs', async () => {
        const body = await draw(3);

        expect(body.querySelector('[data-pane-actions]')).toBeNull();
        expect(body.querySelector('[data-pane-bar]')!.textContent).toContain('Action 2');
    });

    test('gives more controls a bar of their own, and takes them back once they are fewer', async () => {
        const body = await draw(4);

        expect(body.querySelector('[data-pane-actions]')!.textContent).toContain('Action 3');
        expect(body.querySelector('[data-pane-bar]')!.textContent).not.toContain('Action 0');

        await draw(2);

        expect(body.querySelector('[data-pane-actions]')).toBeNull();
        expect(body.querySelector('[data-pane-bar]')!.textContent).toContain('Action 1');
    });
});
