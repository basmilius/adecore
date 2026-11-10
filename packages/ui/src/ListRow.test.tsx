import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ListRow } from './ListRow.tsx';

describe('a list row', () => {
    test('draws no state until it is told whether it is selected', () => {
        const markup = renderToStaticMarkup(<ListRow variant="inset" />);
        expect(markup).not.toContain('aria-current');
        expect(markup).not.toContain('bg-surface-active');
        expect(markup).not.toContain('hover:bg-surface-hover');
    });

    test('marks a selected row current, and hovers one that is not', () => {
        const selected = renderToStaticMarkup(<ListRow variant="inset" selected />);
        const other = renderToStaticMarkup(<ListRow variant="inset" selected={false} />);
        expect(selected).toContain('aria-current="true"');
        expect(selected).toContain('bg-surface-active');
        expect(other).not.toContain('aria-current');
        expect(other).toContain('hover:bg-surface-hover');
    });

    test('marks an option selected rather than current', () => {
        const markup = renderToStaticMarkup(<ListRow variant="inset" role="option" selected />);
        expect(markup).toContain('aria-selected="true"');
        expect(markup).not.toContain('aria-current');
    });

    test('keeps a current value of its own, such as a page', () => {
        expect(renderToStaticMarkup(<ListRow variant="inset" selected aria-current="page" />)).toContain('aria-current="page"');
    });

    test('adds each step of an indent to the start padding of its variant', () => {
        expect(renderToStaticMarkup(<ListRow variant="inset" indent={1} />)).toContain('padding-inline-start:32px');
        expect(renderToStaticMarkup(<ListRow variant="flat" indent={2} />)).toContain('padding-inline-start:48px');
        expect(renderToStaticMarkup(<ListRow variant="inset" />)).not.toContain('style=');
    });
});
