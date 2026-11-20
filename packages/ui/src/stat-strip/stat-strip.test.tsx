import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatStripItem, StatStripRoot } from './parts.tsx';

describe('a stat strip', () => {
    test('is a description list with each label above its value', () => {
        const markup = renderToStaticMarkup(
            <StatStripRoot>
                <StatStripItem label="Open issues" value="48" note="Each counted once" />
            </StatStripRoot>
        );
        expect(markup).toStartWith('<dl');
        expect(markup).toMatch(/<div [^>]*><dt [^>]*>Open issues<\/dt><dd [^>]*>48<\/dd><dd [^>]*>Each counted once<\/dd><\/div>/);
    });

    test('draws no note it was not given', () => {
        expect(renderToStaticMarkup(<StatStripItem label="Sessions" value="25,723" />).match(/<dd/g)).toHaveLength(1);
    });

    test('stands on the raised ground, or on the surface when asked', () => {
        expect(renderToStaticMarkup(<StatStripRoot />)).toContain('bg-surface-raised');
        expect(renderToStaticMarkup(<StatStripRoot ground="surface" />)).not.toContain('bg-surface-raised');
    });
});
