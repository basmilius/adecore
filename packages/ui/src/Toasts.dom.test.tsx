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
});
