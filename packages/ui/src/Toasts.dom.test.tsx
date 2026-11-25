import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createToastStore } from './toast-store.ts';
import { Toasts } from './Toasts.tsx';

describe('the toast stack', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    test('draws a toast shown after it mounted, and the next one too', async () => {
        const store = createToastStore();
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(<Toasts store={store} />));
        expect(container.textContent).toBe('');

        await act(async () => store.getState().show({ id: 'first', kind: 'error', title: 'Push failed' }));
        expect(container.textContent).toContain('Push failed');

        await act(async () => store.getState().show({ id: 'second', kind: 'error', title: 'Pull failed' }));
        expect(container.textContent).toContain('Pull failed');
    });

    test('lets a person select the title and the description, but not the buttons', async () => {
        const store = createToastStore();
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(<Toasts store={store} />));
        await act(async () =>
            store
                .getState()
                .show({ id: 'push', kind: 'error', title: 'Push failed', description: 'Rejected by the remote.', action: { label: 'Retry', run: () => {} } })
        );

        const spans = [...container.querySelectorAll('span')];
        expect(spans.find((span) => span.textContent === 'Push failed')?.classList.contains('select-text')).toBe(true);
        expect(spans.find((span) => span.textContent === 'Rejected by the remote.')?.classList.contains('select-text')).toBe(true);
        expect(container.querySelector('button')?.closest('.select-text')).toBeNull();
    });

    test('fills a bar while work is in progress, and drops it with the outcome', async () => {
        const store = createToastStore();
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(<Toasts store={store} />));

        await act(async () => store.getState().show({ id: 'sync', kind: 'progress', title: 'Syncing', progress: 41 / 120 }));
        expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('34');

        await act(async () => store.getState().update('sync', { progress: 1.5 }));
        expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('100');

        await act(async () => store.getState().update('sync', { kind: 'success', title: 'Synced' }));
        expect(container.querySelector('[role="progressbar"]')).toBeNull();
    });

    test('stops the countdown while the pointer or the focus is on the stack', async () => {
        const store = createToastStore();
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(<Toasts store={store} />));
        await act(async () => store.getState().show({ id: 'deleted', kind: 'deleted', title: 'Deleted view', action: { label: 'Undo', run: () => {} } }));

        const stack = container.querySelector('[role="status"]') as HTMLElement;
        const arc = (): HTMLElement => container.querySelector('.toast-timer-arc') as HTMLElement;
        expect(arc().style.animationPlayState).toBe('running');

        await act(async () => stack.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })));
        expect(arc().style.animationPlayState).toBe('paused');
        expect(store.getState().toasts[0]?.deadline?.pausedAt).toBeDefined();

        await act(async () => stack.dispatchEvent(new MouseEvent('pointerout', { bubbles: true })));
        expect(arc().style.animationPlayState).toBe('running');

        const button = container.querySelector('button') as HTMLButtonElement;
        await act(async () => button.focus());
        expect(arc().style.animationPlayState).toBe('paused');

        await act(async () => button.blur());
        expect(store.getState().toasts[0]?.deadline?.pausedAt).toBeUndefined();
        await act(async () => store.getState().dismiss('deleted'));
    });
});
