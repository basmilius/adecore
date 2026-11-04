import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, createRef, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { setFileIconOverride } from './file-icon.ts';
import { FileIcon } from './FileIcon.tsx';

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/ui/src/FileIcon.test.tsx`.
describe.skipIf(typeof document === 'undefined')('a file icon on screen', () => {
    let container: HTMLDivElement;
    let root: Root;

    const mount = async (node: ReactNode): Promise<void> => {
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
        await act(async () => root.render(node));
    };

    beforeEach(() => {
        container = document.createElement('div');
        document.body.append(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        setFileIconOverride(null);
    });

    test('follows an override set and removed while it is mounted', async () => {
        await mount(<FileIcon path="notes.acme" />);
        expect(container.querySelector('svg')).not.toBeNull();

        await act(async () => setFileIconOverride((path) => (path.endsWith('.acme') ? '/icons/acme.svg' : null)));
        expect(container.querySelector('img')?.getAttribute('src')).toBe('/icons/acme.svg');

        await act(async () => setFileIconOverride(null));
        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('svg')).not.toBeNull();
    });

    test('hands its ref the image of an override', async () => {
        setFileIconOverride(() => '/icons/acme.svg');
        const ref = createRef<SVGSVGElement | HTMLImageElement>();
        await mount(<FileIcon path="notes.acme" ref={ref} />);
        expect(ref.current?.tagName).toBe('IMG');
    });
});
