import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { ZoomControls, type ZoomControlsProps } from './ZoomControls.tsx';

describe('the zoom controls in use', () => {
    let container: HTMLDivElement;
    let root: Root;

    const openPresets = async (side?: ZoomControlsProps['side']): Promise<string | null> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(<ZoomControls zoom={1} onZoomChange={() => {}} onFitAll={() => {}} {...(side === undefined ? {} : { side })} />));
        const trigger = [...container.querySelectorAll('button')].find((button) => button.textContent === '100%');
        await act(async () => trigger!.click());

        return document.querySelector('[role="menu"]')?.getAttribute('data-side') ?? null;
    };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
    });

    test('open the presets above a dock unless asked to open them below a toolbar', async () => {
        expect(await openPresets()).toBe('top');
        await act(async () => root.unmount());
        expect(await openPresets('bottom')).toBe('bottom');
    });
});
