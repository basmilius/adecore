import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';

const HERE = new URL('.', import.meta.url).pathname;
const ROOT = join(HERE, '..');

const sources = (): { path: string; text: string }[] =>
    [...new Glob('**/*.{ts,tsx,css}').scanSync(HERE)].map((path) => ({ path, text: readFileSync(join(HERE, path), 'utf8') }));

describe('the boundary of the package', () => {
    test('the code and the readme never name an app that uses the package', () => {
        const naming = [...sources(), { path: 'README.md', text: readFileSync(join(ROOT, 'README.md'), 'utf8') }]
            .filter(({ path, text }) => path !== 'boundary.test.ts' && /ruimte|aftermotion|solvidi|command[ -]center/i.test(text))
            .map(({ path }) => path);
        expect(naming).toEqual([]);
    });

    test('a color is a token, set only in the two token blocks of the stylesheet', () => {
        const css = readFileSync(join(HERE, 'terminal.css'), 'utf8');
        const rules = css.slice(css.indexOf('@layer components'));
        expect(rules.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/g)).toBeNull();
    });
});

describe('the public API', () => {
    test('the package exports these names', async () => {
        expect(Object.keys(await import('./index.ts')).sort()).toEqual(['TerminalView', 'linkLineBounds', 'webglTerminals']);
    });
});
