import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { absolute, exportedNames, publishedEntries } from './published-exports.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ENTRIES = publishedEntries();

/* The snapshot that holds each published package's public API, empty for a package without one. */
const SNAPSHOTS = new Map(
    ENTRIES.map(({ pkg, file }) => {
        const path = absolute(join(file.split('/').slice(0, 2).join('/'), 'src/__snapshots__/exports.test.ts.snap'));

        return [pkg, existsSync(path) ? readFileSync(path, 'utf8') : ''];
    })
);

function filesIn(pattern: string): { path: string; text: string }[] {
    return [...new Glob(pattern).scanSync({ cwd: HERE, dot: true })]
        .map((path) => path.replaceAll('\\', '/'))
        .filter((path) => !/(^|\/)(node_modules|dist|cache)\//.test(path))
        .map((path) => ({ path, text: readFileSync(join(HERE, path), 'utf8') }));
}

const PAGES = filesIn('**/*.md')
    .map(({ text }) => text)
    .join('\n');

/* Every name an entry point exports, types included, read from the snapshot that holds the public API. */
function snapshotNames(pkg: string, entry: string): string[] {
    const block = SNAPSHOTS.get(pkg)!.split(`exports[\`the public API ${entry} exports these names 1\`] = \``)[1]?.split('`')[0] ?? '';

    return [...block.matchAll(/"(?:type )?([\w$]+)"/g)].map((name) => name[1]!);
}

/* Every part of a compound component, as `Menu.Item`. */
function compoundParts(): string[] {
    return [...SNAPSHOTS.values()].flatMap((snapshot) => {
        const block = /exports\[`the public API the compound components have these parts 1`\] = `([^`]*)`/.exec(snapshot)?.[1];

        return block === undefined ? [] : partsIn(block);
    });
}

function partsIn(block: string): string[] {
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
}

const WORDS = new Set(PAGES.match(/[\w$]+/g));

function mentioned(name: string): boolean {
    return name.includes('.') ? new RegExp(`(?<![\\w$])${name.replace('.', '\\.')}(?![\\w$])`).test(PAGES) : WORDS.has(name);
}

/* The apps that use the library, which no page names. */
const APP_NAMES = /ruimte|aftermotion|solvidi|command[ -]center/i;

describe('the docs', () => {
    test('read the public API out of the snapshot of every published package', () => {
        // An entry whose names its snapshot does not hold would stay out of the check below.
        const unguarded = ENTRIES.filter(({ pkg, entry, file }) => {
            const source = exportedNames(absolute(file)).sort();

            return JSON.stringify(snapshotNames(pkg, entry).sort()) !== JSON.stringify(source);
        }).map(({ pkg, entry }) => `${pkg} ${entry}`);
        expect(new Set(ENTRIES.map((entry) => entry.pkg)).size).toBeGreaterThan(10);
        expect(unguarded).toEqual([]);
        expect(compoundParts()).toContain('Menu.Item');
    });

    test('mention every name every published package exports', () => {
        const missing = ENTRIES.flatMap(({ pkg, entry }) =>
            snapshotNames(pkg, entry)
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
