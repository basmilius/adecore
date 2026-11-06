import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { RelativeTime } from './RelativeTime.tsx';

describe('a relative time', () => {
    test('reads as its age, carries the moment as a machine-readable time and is a tab stop for its tooltip', () => {
        const at = Date.now() - 5 * 60_000;
        const markup = renderToStaticMarkup(<RelativeTime at={at} />);
        expect(markup).toContain(`dateTime="${new Date(at).toISOString()}"`);
        expect(markup).toContain('tabindex="0"');
        expect(markup).toContain('>5m ago</time>');
    });

    test('has no tab stop of its own without its tooltip, for a row that takes the focus itself', () => {
        const at = Date.now() - 5 * 60_000;
        const markup = renderToStaticMarkup(<RelativeTime at={at} tooltip={false} />);
        expect(markup).toBe(`<time dateTime="${new Date(at).toISOString()}" class="whitespace-nowrap">5m ago</time>`);
    });

    test('draws a dash for a moment that is not known, with no tab stop', () => {
        for (const at of [null, undefined, new Date(Number.NaN)]) {
            const markup = renderToStaticMarkup(<RelativeTime at={at} className="text-text-faint" />);
            expect(markup).toBe('<span class="text-text-faint">-</span>');
        }
    });
});
