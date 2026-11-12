import { afterEach, describe, expect, test } from 'bun:test';
import i18next from 'i18next';
import { act, useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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

// A bar that never settles renders without end, which would hang the run rather than fail it.
const RENDER_LIMIT = 100;

const renders = { count: 0 };

/* A pane whose body portals its controls into a slot in the bar, which it learns of a render after the slot mounted. */
function SlottedPane({ count }: { count: number }): ReactNode {
    const [slot, setSlot] = useState<HTMLElement | null>(null);
    const mount = (element: HTMLElement | null): (() => void) | undefined => {
        if (element === null) {
            return undefined;
        }

        setSlot(element);

        return () => setSlot((current) => (current === element ? null : current));
    };

    useLayoutEffect(() => {
        renders.count += 1;

        if (renders.count > RENDER_LIMIT) {
            throw new Error(`The pane rendered more than ${RENDER_LIMIT} times`);
        }
    });

    const controls = Array.from({ length: count }, (_, index) => (
        <button key={index} type="button">
            Action {index}
        </button>
    ));

    return (
        <>
            <PaneBar title="Tabs" tabs actions={<div ref={mount} />} onClose={() => undefined} closeLabel="Close cell" />
            {slot !== null && createPortal(controls, slot)}
        </>
    );
}

async function drawSlotted(count: number): Promise<HTMLElement> {
    const host = document.createElement('div');

    document.body.append(host);
    root ??= createRoot(host);
    renders.count = 0;

    await act(async () => {
        root!.render(
            <UIProvider i18n={i18n}>
                <SlottedPane count={count} />
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

    test('settles when the controls portal into a slot that moves with them', async () => {
        const body = await drawSlotted(5);

        expect(body.querySelector('[data-pane-actions]')!.textContent).toContain('Action 4');
        expect(body.querySelector('[data-pane-bar]')!.textContent).not.toContain('Action 0');

        await drawSlotted(2);

        expect(body.querySelector('[data-pane-actions]')).toBeNull();
        expect(body.querySelector('[data-pane-bar]')!.textContent).toContain('Action 1');
    });
});
