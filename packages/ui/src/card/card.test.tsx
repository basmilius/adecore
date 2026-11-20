import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { Pill } from '../Pill.tsx';
import { CardBody, CardFooter, CardHeader, CardRoot } from './parts.tsx';

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

    test('ends the header with the toggle, after its children', () => {
        const markup = renderToStaticMarkup(
            <CardRoot collapsible>
                <CardHeader title="Extra keys">
                    <Pill>Three</Pill>
                </CardHeader>
            </CardRoot>
        );
        expect(markup).toContain('lucide-chevron-down');
        expect(markup).toContain('class="ade-card-end ');
        expect(markup.indexOf('Three')).toBeLessThan(markup.indexOf('<button'));
    });

    test('starts the header with the toggle when asked, and keeps the children at the end', () => {
        const markup = renderToStaticMarkup(
            <CardRoot collapsible>
                <CardHeader title="Extra keys" toggle="start">
                    <Pill>Three</Pill>
                </CardHeader>
            </CardRoot>
        );
        const folded = renderToStaticMarkup(
            <CardRoot collapsible defaultOpen={false}>
                <CardHeader title="Extra keys" toggle="start" />
            </CardRoot>
        );
        expect(markup).toContain('lucide-chevron-down');
        expect(markup.indexOf('<button')).toBeLessThan(markup.indexOf('<h2'));
        expect(markup.indexOf('Three')).toBeGreaterThan(markup.indexOf('<h2'));
        expect(folded).toContain('lucide-chevron-right');
    });

    test('keeps its body on the content edge under a toggle at the start', () => {
        const markup = renderToStaticMarkup(
            <CardRoot collapsible>
                <CardHeader title="Extra keys" toggle="start" />
                <CardBody>Keys</CardBody>
            </CardRoot>
        );
        expect(markup).toContain('p-4 [[data-card-header]+&amp;]:pt-1"');
    });

    test('stacks its parts in a column whose body takes the height left over', () => {
        const markup = renderToStaticMarkup(
            <CardRoot>
                <CardBody flush>Rows</CardBody>
            </CardRoot>
        );
        expect(markup).toContain('flex min-w-0 flex-col');
        expect(markup).toContain('flex min-h-0 min-w-0 grow flex-col pb-1');
    });

    test('keeps its footer at the bottom edge, also without a body', () => {
        const markup = renderToStaticMarkup(
            <CardRoot>
                <CardHeader title="Clients" />
                <CardFooter>View all</CardFooter>
            </CardRoot>
        );
        expect(markup).toMatch(/<footer class="ade-card-line ade-card-footer mt-auto [^"]*border-t[^"]*">View all<\/footer>/);
    });

    test('folds its footer away with its body', () => {
        const markup = renderToStaticMarkup(
            <CardRoot collapsible defaultOpen={false}>
                <CardHeader title="Clients" />
                <CardBody>Rows</CardBody>
                <CardFooter>View all</CardFooter>
            </CardRoot>
        );
        expect(markup).not.toContain('View all');
    });

    test('insets an icon button at an end of a line by the height of that button', () => {
        const theme = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');
        const heights = [...theme.matchAll(/\.(icon-btn(?:-\w+)?) \{[^}]*?height: (\d+px)/g)].map((match) => [match[1], match[2]]);
        const insets = [...theme.matchAll(/\.ade-card-line \.(icon-btn(?:-\w+)?) \{ --card-line-button: (\d+px); \}/g)].map((match) => [match[1], match[2]]);
        expect(heights.length).toBe(4);
        expect(insets).toEqual(heights);
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
