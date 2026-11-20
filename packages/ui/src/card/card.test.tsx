import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Pill } from '../Pill.tsx';
import { CardBody, CardHeader, CardRoot } from './parts.tsx';

describe('a card', () => {
    test('is a section on the raised ground, or on the surface when asked', () => {
        const raised = renderToStaticMarkup(<CardRoot />);
        const surface = renderToStaticMarkup(<CardRoot ground="surface" />);
        expect(raised).toStartWith('<section');
        expect(raised).toContain('bg-surface-raised');
        expect(surface).toContain('bg-surface');
        expect(surface).not.toContain('bg-surface-raised');
    });

    test('draws its title as a heading with the actions after it', () => {
        const markup = renderToStaticMarkup(
            <CardRoot>
                <CardHeader title="Volume">
                    <Pill>absolute</Pill>
                </CardHeader>
            </CardRoot>
        );
        expect(markup).toMatch(/<h2 id="[^"]+"[^>]*>Volume<\/h2>/);
        expect(markup).toContain('absolute');
    });

    test('pads a body all round, and leaves the space above it to a header', () => {
        const markup = renderToStaticMarkup(
            <CardRoot>
                <CardBody>Facts</CardBody>
            </CardRoot>
        );
        expect(markup).toContain('p-4 [[data-card-header]+&amp;]:pt-1');
        expect(renderToStaticMarkup(<CardBody flush />)).not.toContain('p-4');
    });

    test('shows only its header and a toggle to open it while folded', () => {
        const markup = renderToStaticMarkup(
            <CardRoot collapsible defaultOpen={false}>
                <CardHeader title="Extra keys">
                    <Pill>Three</Pill>
                </CardHeader>
                <CardBody>Keys</CardBody>
            </CardRoot>
        );
        expect(markup).toContain('aria-label="Expand"');
        expect(markup).toContain('aria-expanded="false"');
        expect(markup).not.toContain('Keys');
        expect(markup).not.toContain('Three');
    });

    test('draws no toggle when it does not fold', () => {
        const markup = renderToStaticMarkup(
            <CardRoot>
                <CardHeader title="Device" />
            </CardRoot>
        );
        expect(markup).not.toContain('aria-expanded');
    });
});
