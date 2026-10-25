import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CliMark } from './parts';

describe('CliMark', () => {
    test('a known CLI wears its mark in its chart color', () => {
        const markup = renderToStaticMarkup(createElement(CliMark, { kind: 'claude' }));
        expect(markup).toContain('text-chart-claude');
        expect(markup).toContain('aria-label="Claude"');
    });

    test('a provider with a usage chart color wears it here too, so its mark reads the same on both', () => {
        expect(renderToStaticMarkup(createElement(CliMark, { kind: 'nanogpt' }))).toContain('text-chart-nanogpt');
        const grok = renderToStaticMarkup(createElement(CliMark, { kind: 'grok' }));
        expect(grok).toContain('text-chart-grok');
        expect(grok).toContain('aria-label="Grok"');
        expect(renderToStaticMarkup(createElement(CliMark, { kind: 'anthropic-claude-api' }))).toContain('text-chart-claude-api');
    });

    test('a CLI this version has no mark for falls back to a muted bot', () => {
        const markup = renderToStaticMarkup(createElement(CliMark, { kind: 'antigravity' }));
        expect(markup).toContain('text-text-muted');
        expect(markup).toContain('lucide-bot');
        expect(markup).not.toContain('text-chart-');
    });
});
