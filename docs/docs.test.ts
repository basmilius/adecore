import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';
import { absolute, exportedNames, publishedEntries } from './published-exports.ts';

const HERE = new URL('.', import.meta.url).pathname;
const SNAPSHOT = readFileSync(join(HERE, '../packages/ui/src/__snapshots__/exports.test.ts.snap'), 'utf8');

const filesIn = (pattern: string): { path: string; text: string }[] =>
    [...new Glob(pattern).scanSync({ cwd: HERE, dot: true })]
        .filter((path) => !/(^|\/)(node_modules|dist|cache)\//.test(path))
        .map((path) => ({ path, text: readFileSync(join(HERE, path), 'utf8') }));

const PAGES = filesIn('**/*.md')
    .map(({ text }) => text)
    .join('\n');

/* Every name an entry point exports, types included, read from the snapshot that holds the public API. */
const snapshotNames = (): string[] =>
    [...SNAPSHOT.matchAll(/exports\[`the public API \S+ exports these names 1`\] = `([^`]*)`/g)].flatMap((block) =>
        [...block[1]!.matchAll(/"(?:type )?([\w$]+)"/g)].map((name) => name[1]!)
    );

/* Every part of a compound component, as `Menu.Item`. */
const compoundParts = (): string[] => {
    const block = /exports\[`the public API the compound components have these parts 1`\] = `([^`]*)`/.exec(SNAPSHOT)![1]!;
    const parts: string[] = [];
    let compound = '';
    for (const line of block.split('\n')) {
        const opens = /^ {2}"(\w+)": \[$/.exec(line);
        const part = /^ {4}"(\w+)",?$/.exec(line);
        if (opens) {
            compound = opens[1]!;
        } else if (part) {
            parts.push(`${compound}.${part[1]}`);
        }
    }
    return parts;
};

const WORDS = new Set(PAGES.match(/[\w$]+/g));

const mentioned = (name: string): boolean =>
    name.includes('.') ? new RegExp(`(?<![\\w$])${name.replace('.', '\\.')}(?![\\w$])`).test(PAGES) : WORDS.has(name);

/* The apps that use the library, which no page names. */
const APP_NAMES = /ruimte|aftermotion|solvidi|command[ -]center/i;

describe('the docs', () => {
    test('read the public API out of the snapshot', () => {
        expect(snapshotNames().length).toBeGreaterThan(200);
        expect(compoundParts()).toContain('Menu.Item');
    });

    test('mention every exported name on some page', () => {
        expect(snapshotNames().filter((name) => !mentioned(name))).toEqual([]);
    });

    test('mention every name every published package exports', () => {
        const entries = publishedEntries();
        expect(new Set(entries.map((entry) => entry.pkg)).size).toBeGreaterThan(10);
        const missing = entries.flatMap(({ pkg, entry, file }) =>
            exportedNames(absolute(file))
                // A legacy name that carries an app's name stays out of the pages, which describe it generically.
                .filter((name) => !mentioned(name) && !APP_NAMES.test(name))
                .map((name) => `${pkg} ${entry} ${name}`)
        );
        expect(missing).toEqual([]);
    });

    test('mention every part of every compound component', () => {
        expect(compoundParts().filter((part) => !mentioned(part))).toEqual([]);
    });

    test('never name an app that uses the library', () => {
        const naming = filesIn('**/*.{md,ts,tsx,vue,css}')
            .filter(({ path, text }) => path !== 'docs.test.ts' && APP_NAMES.test(text))
            .map(({ path }) => path);
        expect(naming).toEqual([]);
    });
});
