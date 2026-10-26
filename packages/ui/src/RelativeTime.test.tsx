import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { setFormatSource, type FormatSource } from './format/locale.ts';
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

// Runs with the DOM preload: `bun test --preload ./packages/ui/src/file-tree/testing/preload.ts packages/ui/src/RelativeTime.test.tsx`.
describe.skipIf(typeof document === 'undefined')('a relative time on screen', () => {
    let container: HTMLDivElement;
    let root: Root;
    let previousFormatSource: FormatSource;
    let region: string;
    let listeners: Set<() => void>;

    beforeEach(async () => {
        region = 'en-US';
        listeners = new Set();

        previousFormatSource = setFormatSource({
            language: () => 'en',
            region: () => region,
            subscribe: (onChange) => {
                listeners.add(onChange);

                return () => listeners.delete(onChange);
            }
        });

        container = document.createElement('div');
        document.body.append(container);
        const { createRoot } = await import('react-dom/client');
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        setFormatSource(previousFormatSource);
        jest.useRealTimers();
    });

    test('draws again in the notation of a region a person switches to', async () => {
        const at = new Date(2020, 0, 2, 12);
        await act(async () => root.render(<RelativeTime at={at} />));
        expect(container.textContent).toBe('Jan 2, 2020');

        region = 'nl-NL';
        await act(async () => listeners.forEach((onChange) => onChange()));
        expect(container.textContent).toBe('2 Jan 2020');
    });

    test('counts on while it is on screen', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(2026, 9, 24, 12));
        await act(async () => root.render(<RelativeTime at={Date.now() - 4 * 60_000} />));
        expect(container.textContent).toBe('4m ago');

        await act(async () => jest.advanceTimersByTime(90_000));
        expect(container.textContent).toBe('5m ago');
    });
});
