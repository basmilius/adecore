import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { readThemeTokens } from './.vitepress/theme/theme-tokens.ts';

const { tokens, scale } = readThemeTokens(readFileSync(new URL('../packages/ui/src/theme.css', import.meta.url), 'utf8'));

test('lists the accent as text with its Tailwind utility, in the accent group', () => {
    const token = tokens.find((entry) => entry.name === 'accent-on-surface');

    expect(token).toMatchObject({ group: 'accent', light: 'var(--accent)', dark: 'var(--accent)', utility: 'accent-on-surface' });
});

test('keeps the text color mapping out of the type scale', () => {
    expect(scale.some((entry) => entry.name.startsWith('text-color-'))).toBe(false);
});
