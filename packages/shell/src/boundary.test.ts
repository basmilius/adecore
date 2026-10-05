import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';

const HERE = new URL('.', import.meta.url).pathname;
const ROOT = join(HERE, '..');

const sources = (): { path: string; text: string }[] =>
    [...new Glob('**/*.ts').scanSync(HERE)].map((path) => ({ path, text: readFileSync(join(HERE, path), 'utf8') }));

describe('the boundary of the package', () => {
    test('the bridge never imports Electron, so a preload and a page can read it', () => {
        const importing = sources().filter(({ path, text }) => path.startsWith('bridge/') && /from ['"]electron/.test(text));
        expect(importing.map(({ path }) => path)).toEqual([]);
    });

    test('the code and the readme never name an app that uses the package', () => {
        const naming = [...sources(), { path: 'README.md', text: readFileSync(join(ROOT, 'README.md'), 'utf8') }]
            .filter(({ path, text }) => path !== 'boundary.test.ts' && /ruimte|aftermotion|solvidi|command[ -]center/i.test(text))
            .map(({ path }) => path);
        expect(naming).toEqual([]);
    });
});
