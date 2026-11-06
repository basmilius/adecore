import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { lazyNamed } from './lazy.tsx';
import { LazyBoundary } from './LazyBoundary.tsx';

describe('a lazy boundary', () => {
    test('shows the module as soon as it lands, where React would hold a retry back until 300 ms after the fallback', async () => {
        const { createRoot } = await import('react-dom/client');
        const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
        const acting = scope.IS_REACT_ACT_ENVIRONMENT;
        // Under `act` React never throttles, so the boundary is drawn the way a page draws it.
        scope.IS_REACT_ACT_ENVIRONMENT = false;
        let land!: () => void;

        const landed = new Promise<void>((resolve) => {
            land = resolve;
        });

        const Surface = lazyNamed(async () => {
            await landed;

            return { Surface: () => createElement('p', null, 'here') };
        }, 'Surface');

        const container = document.createElement('div');
        const root = createRoot(container);

        const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

        try {
            root.render(createElement(LazyBoundary, { fallback: 'waiting' }, createElement(Surface)));

            for (let i = 0; i < 20 && container.textContent !== 'waiting'; i++) {
                await tick();
            }

            expect(container.textContent).toBe('waiting');

            land();

            for (let i = 0; i < 20 && container.textContent !== 'here'; i++) {
                await tick();
            }

            expect(container.textContent).toBe('here');
        } finally {
            root.unmount();
            scope.IS_REACT_ACT_ENVIRONMENT = acting;
        }
    });
});
