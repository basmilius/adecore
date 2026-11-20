import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardGrid } from './CardGrid.tsx';
import { cardSpan } from './context.ts';
import { CardBody, CardHeader, CardRoot } from './parts.tsx';

describe('the place of a card', () => {
    test('is a number of columns inside the grid, or the full row', () => {
        const grid = { columns: 3, flow: 'grid' } as const;
        expect(cardSpan(2, grid)).toBe('2');
        expect(cardSpan('full', grid)).toBe('full');
        expect(cardSpan(1, grid)).toBeUndefined();
        expect(cardSpan(undefined, grid)).toBeUndefined();
    });

    test('is the full row once it spans as many columns as the grid has', () => {
        expect(cardSpan(3, { columns: 3, flow: 'grid' })).toBe('full');
        expect(cardSpan(4, { columns: 2, flow: 'grid' })).toBe('full');
    });

    test('is the full row for any span above one in masonry', () => {
        expect(cardSpan(2, { columns: 3, flow: 'masonry' })).toBe('full');
    });

    test('is nothing outside a grid', () => {
        expect(cardSpan('full', null)).toBeUndefined();
    });
});

describe('a card grid', () => {
    test('tells its cards where they stand without reading them', () => {
        const Wide = () => (
            <CardRoot span={2}>
                <CardBody>Chart</CardBody>
            </CardRoot>
        );
        const markup = renderToStaticMarkup(
            <CardGrid columns={3}>
                <Wide />
            </CardGrid>
        );
        expect(markup).toContain('data-columns="3" data-flow="grid"');
        expect(markup).toContain('<section data-card-span="2"');
    });

    test('is a group named by its heading, with the cards one heading level below it', () => {
        const markup = renderToStaticMarkup(
            <CardGrid title="Advanced">
                <CardRoot>
                    <CardHeader title="Extra keys" />
                </CardRoot>
            </CardGrid>
        );
        const headingId = /<h2 id="([^"]+)"/.exec(markup)?.[1];
        expect(markup).toStartWith(`<section aria-labelledby="${headingId}"`);
        expect(markup).toContain('Advanced');
        expect(markup).toMatch(/<h3 [^>]*>Extra keys<\/h3>/);
    });

    test('is a plain box without a title', () => {
        expect(renderToStaticMarkup(<CardGrid />)).toStartWith('<div data-columns="2"');
    });

    test('takes the full row of a grid around it, so two groups never share a column', () => {
        const markup = renderToStaticMarkup(
            <CardGrid columns={1}>
                <CardGrid title="Playback" flow="masonry">
                    <CardGrid title="Queue" />
                </CardGrid>
            </CardGrid>
        );
        expect(markup.match(/data-card-span="full"/g)).toHaveLength(2);
        expect(markup).toMatch(/<h3 [^>]*>.*Queue/);
    });

    test('leaves a card inside a card out of its columns', () => {
        const markup = renderToStaticMarkup(
            <CardGrid>
                <CardRoot>
                    <CardBody>
                        <CardRoot span="full" />
                    </CardBody>
                </CardRoot>
            </CardGrid>
        );
        expect(markup).not.toContain('data-card-span');
    });
});
