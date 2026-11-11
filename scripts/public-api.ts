import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync, type Program } from 'oxc-parser';

export interface PublicApi {
    /* The `import.meta.url` of the package's `src/exports.test.ts`. */
    readonly url: string;

    /* Every entry point by its subpath, and its file under `src`. */
    readonly entries: Readonly<Record<string, string>>;

    /* The exports that hold data rather than names, so no snapshot covers them. */
    readonly assets?: readonly string[];

    /* The namespaces of the root entry whose parts are API too. */
    readonly compounds?: readonly string[];
}

type Statement = Program['body'][number];
type Declaration = NonNullable<Extract<Statement, { type: 'ExportNamedDeclaration' }>['declaration']>;

function declaredNames(declaration: Declaration): string[] {
    switch (declaration.type) {
        case 'VariableDeclaration':
            return declaration.declarations.flatMap((declarator) => (declarator.id.type === 'Identifier' ? [declarator.id.name] : []));
        case 'TSInterfaceDeclaration':
        case 'TSTypeAliasDeclaration':
            return [`type ${declaration.id.name}`];
        default:
            return 'id' in declaration && declaration.id?.type === 'Identifier' ? [declaration.id.name] : [];
    }
}

/* What an entry file names, values and types alike, from its export lists and its exported declarations. */
function namesIn(path: string): string[] {
    const program = parseSync(path, readFileSync(path, 'utf8')).program;

    return program.body.flatMap((statement: Statement) => {
        if (statement.type === 'ExportNamedDeclaration' && statement.declaration) {
            return declaredNames(statement.declaration);
        }

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
}

/* Snapshots every name each entry point exports, so a removed or renamed export fails a test. */
export async function describePublicApi({ url, entries, assets = [], compounds = [] }: PublicApi): Promise<void> {
    const here = fileURLToPath(new URL('.', url));
    const pathOf = (file: string): string => join(here, file);

    // Loaded before the tests, so compiling every module of the package through the test preload counts against no test's timeout.
    const modules: Record<string, Record<string, unknown>> = Object.fromEntries(
        await Promise.all(Object.entries(entries).map(async ([entry, file]) => [entry, (await import(pathOf(file))) as Record<string, unknown>]))
    );

    describe('the public API', () => {
        test('the package exports these entry points and nothing else', () => {
            const manifest = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { exports: Record<string, unknown> };
            expect(Object.keys(manifest.exports).sort()).toEqual([...Object.keys(entries), ...assets].sort());
        });

        test.each(Object.entries(entries))('%s names every export itself', (_entry, file) => {
            // A star re-export would let a new export in a module slip past the snapshot.
            expect(namesIn(pathOf(file)).filter((name) => name.startsWith('* from'))).toEqual([]);
        });

        test.each(Object.entries(entries))('%s exports these names', (_entry, file) => {
            expect(namesIn(pathOf(file)).sort()).toMatchSnapshot();
        });

        if (compounds.length > 0) {
            test('the compound components have these parts', () => {
                const root = modules['.']!;
                expect(Object.fromEntries(compounds.map((name) => [name, Object.keys(root[name] as object).sort()]))).toMatchSnapshot();
            });
        }

        test('every value an entry names is there at run time', () => {
            for (const [entry, file] of Object.entries(entries)) {
                const module = modules[entry]!;
                const values = namesIn(pathOf(file)).filter((name) => !name.startsWith('type '));
                expect({ entry, missing: values.filter((name) => module[name] === undefined) }).toEqual({ entry, missing: [] });
            }
        });
    });
}
