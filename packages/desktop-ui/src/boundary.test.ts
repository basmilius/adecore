import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';

const HERE = new URL('.', import.meta.url).pathname;
const ROOT = join(HERE, '..');

const sources = (): { path: string; text: string }[] =>
    [...new Glob('**/*.{ts,tsx,css,json}').scanSync(HERE)].map((path) => ({ path, text: readFileSync(join(HERE, path), 'utf8') }));

/* What an app has and a library never reaches: an app's alias, a path out of `src`, or a package of an app. */
const REACHES_OUT = /from ['"](?:@\/|~\/|(?:\.\.\/)+(?:\.\.\/|apps\/|packages\/)|@ruimte\/|@aftermotion\/)/;

/* The documents a person reads to use the library; the notes for agents may name the apps. */
const PUBLIC_DOCS = ['README.md'];

describe('the boundary of the library', () => {
    test('nothing imports from an app or from outside src', () => {
        const reaching = sources()
            .filter(({ path, text }) => /\.tsx?$/.test(path) && REACHES_OUT.test(text))
            .map(({ path }) => path);
        expect(reaching).toEqual([]);
    });

    test('nothing leaves src through a relative import', () => {
        const escaping = sources().filter(({ path, text }) => {
            const depth = path.split('/').length - 1;
            return [...text.matchAll(/from ['"]((?:\.\.\/)+)/g)].some((match) => match[1]!.length / 3 > depth);
        });
        expect(escaping.map(({ path }) => path)).toEqual([]);
    });

    test('the code and the public docs never name an app that uses the library', () => {
        const naming = [...sources(), ...PUBLIC_DOCS.map((path) => ({ path, text: readFileSync(join(ROOT, path), 'utf8') }))]
            .filter(({ text }) => /ruimte|aftermotion/i.test(text))
            .map(({ path }) => path);
        expect(naming.filter((path) => path !== 'boundary.test.ts')).toEqual([]);
    });
});
