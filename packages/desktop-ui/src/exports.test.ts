import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { parseSync, type Program } from 'oxc-parser';

const HERE = new URL('.', import.meta.url).pathname;
const ROOT = join(HERE, '..');

/* Every entry point by its subpath, and the file behind it. */
const ENTRIES: Record<string, string> = {
    '.': 'index.ts',
    './settings': 'settings/index.ts',
    './format': 'format/index.ts',
    './terminal': 'terminal/index.ts',
    './testing': 'testing/index.ts',
    './testing/dedupe': 'testing/dedupe.ts'
};

type Declaration = Program['body'][number];

/* What an entry file names, values and types alike, as written in its export statements. */
const namesIn = (file: string): string[] => {
    const program = parseSync(file, readFileSync(join(HERE, file), 'utf8')).program;
    return program.body.flatMap((statement: Declaration) => {
        if (statement.type === 'ExportNamedDeclaration') {
            const typeOnly = statement.exportKind === 'type';
            return statement.specifiers.map((specifier) => {
                const exported = specifier.exported.type === 'Identifier' ? specifier.exported.name : String(specifier.exported.value);
                return typeOnly || specifier.exportKind === 'type' ? `type ${exported}` : exported;
            });
        }
        if (statement.type === 'ExportAllDeclaration' && statement.exported !== null) {
            return [statement.exported.type === 'Identifier' ? statement.exported.name : String(statement.exported.value)];
        }
        if (statement.type === 'ExportAllDeclaration') {
            return [`* from ${statement.source.value}`];
        }
        return [];
    });
};

describe('the public API', () => {
    test('the package exports these entry points and nothing else', () => {
        const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { exports: Record<string, unknown> };
        expect(Object.keys(manifest.exports).sort()).toEqual([...Object.keys(ENTRIES), './theme.css'].sort());
    });

    test.each(Object.entries(ENTRIES))('%s names every export itself', (_entry, file) => {
        // A star re-export would let a new export in a module slip past the snapshot.
        expect(namesIn(file).filter((name) => name.startsWith('* from'))).toEqual([]);
    });

    test.each(Object.entries(ENTRIES))('%s exports these names', (_entry, file) => {
        expect(namesIn(file).sort()).toMatchSnapshot();
    });

    test('the compound components have these parts', async () => {
        const barrel = (await import('./index.ts')) as Record<string, unknown>;
        const parts = Object.fromEntries(
            ['ContextMenu', 'Dialog', 'Menu', 'Popover', 'PreviewCard'].map((name) => [name, Object.keys(barrel[name] as object).sort()])
        );
        expect(parts).toMatchSnapshot();
    });

    test('every value an entry names is there at run time', async () => {
        for (const [entry, file] of Object.entries(ENTRIES)) {
            const module = (await import(`./${file}`)) as Record<string, unknown>;
            const values = namesIn(file).filter((name) => !name.startsWith('type '));
            expect({ entry, missing: values.filter((name) => module[name] === undefined) }).toEqual({ entry, missing: [] });
        }
    });
});
