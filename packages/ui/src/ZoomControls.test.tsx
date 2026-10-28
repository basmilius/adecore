import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { ZoomControls, type ZoomControlsProps } from './ZoomControls.tsx';

function markupOf(size?: ZoomControlsProps['size']): string {
    return renderToStaticMarkup(<ZoomControls zoom={0.75} onZoomChange={() => {}} onFitAll={() => {}} {...(size === undefined ? {} : { size })} />);
}

describe('the zoom controls', () => {
    test('stand at the size of a dock unless asked for the small buttons of a toolbar', () => {
        const dock = markupOf();
        const toolbar = markupOf('sm');

        expect(dock).toContain('h-8 min-w-14 rounded-lg');
        expect(dock).not.toContain('icon-btn-sm');
        expect(toolbar).toContain('h-7 min-w-12 rounded-md');
        expect(toolbar.match(/icon-btn icon-btn-sm/g)).toHaveLength(3);
        expect(toolbar).toContain('75%');
    });
});

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/ui/src/ZoomControls.test.tsx`.
describe.skipIf(typeof document === 'undefined')('the zoom controls in use', () => {
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
