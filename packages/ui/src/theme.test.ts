import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { treeRowStyle } from './tree/style.ts';

const THEME = readFileSync(new URL('./theme.css', import.meta.url), 'utf8');
const EDITOR = readFileSync(new URL('../../editor-react/src/editor-react.css', import.meta.url), 'utf8');

/* The declarations of the last block that starts with the selector, without its comments. */
function block(css: string, selector: string): string {
    const start = css.lastIndexOf(`${selector} {`);

    return css.slice(start, css.indexOf('\n}', start)).replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('the accent as text and as a focus ring', () => {
    test('is the accent itself in both themes until an app sets it', () => {
        expect(block(THEME, ':root, [data-theme="light"]')).toContain('--accent-on-surface: var(--accent);');
        expect(block(THEME, '[data-theme="dark"]')).toContain('--accent-on-surface: var(--accent);');
    });

    test('moves text-accent onto it while the fills keep the exact accent', () => {
        const mapping = block(THEME, '@theme inline');

        expect(mapping).toContain('--text-color-accent: var(--accent-on-surface);');
        expect(mapping).toContain('--color-accent: var(--accent);');
        expect(mapping).toContain('--color-accent-on-surface: var(--accent-on-surface);');
    });

    test('draws every focus outline of the theme in it', () => {
        const outlines = [...THEME.matchAll(/(\S+:focus-visible[^{]*|\.focus-ring-within:has\([^{]*)\{[^}]*outline:\s*2px solid ([^;]+);/g)];

        expect(outlines.length).toBeGreaterThanOrEqual(4);
        expect(outlines.map((match) => match[2])).toEqual(outlines.map(() => 'var(--accent-on-surface)'));
        expect(THEME).toContain('--trees-focus-ring-color-override: var(--accent-on-surface);');
    });

    test('draws the outline of a tree row and of the editor panel in it', () => {
        expect(treeRowStyle('.row')).toContain('outline: 2px solid var(--accent-on-surface);');
        expect(EDITOR).toContain('outline: 2px solid var(--accent-on-surface);');
    });
});
