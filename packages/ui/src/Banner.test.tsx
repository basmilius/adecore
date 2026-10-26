import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CircleAlert } from 'lucide-react';
import { Banner } from './Banner.tsx';

const rootClasses = (markup: string): string[] => markup.match(/^<div[^>]* class="([^"]*)"/)![1]!.split(' ');

describe('a banner', () => {
    test('floats along the top of its parent by default', () => {
        const classes = rootClasses(renderToStaticMarkup(<Banner icon={CircleAlert} tone="error" message="Failed." />));
        expect(classes).toEqual(expect.arrayContaining(['absolute', 'inset-x-0', 'top-3']));
    });

    test('lets a className replace the overlay position, with or without the placement named', () => {
        for (const placement of [undefined, 'overlay'] as const) {
            const classes = rootClasses(
                renderToStaticMarkup(<Banner placement={placement} icon={CircleAlert} tone="error" message="Failed." className="w-full" />)
            );

            expect(classes).toContain('w-full');
            expect(classes).not.toContain('absolute');
        }
    });

    test('stands in the flow as one bordered row when inline', () => {
        const markup = renderToStaticMarkup(<Banner placement="inline" icon={CircleAlert} tone="attention" message="Hit the limit." className="mt-2" />);
        const classes = rootClasses(markup);
        expect(classes).toEqual(expect.arrayContaining(['border', 'mt-2']));
        expect(classes).not.toContain('absolute');
        expect(markup).not.toContain('max-w-[640px]');
        expect(markup).toContain('role="status"');
    });
});
