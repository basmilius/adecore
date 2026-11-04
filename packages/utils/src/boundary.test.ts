import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// A page imports these entries, so neither they nor what they import may reach for Node or Bun.
const PAGE_ENTRIES = ['async.ts', 'errors.ts', 'record.ts', 'text.ts'];

function importsOf(file: string, seen = new Set<string>()): string[] {
    if (seen.has(file)) {
        return [];
    }

    seen.add(file);
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const specifiers = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1]!);

    return specifiers.flatMap((specifier) => (specifier.startsWith('./') ? [specifier, ...importsOf(specifier.slice(2), seen)] : [specifier]));
}

describe('the entries for a page', () => {
    test.each(PAGE_ENTRIES)('%s imports no platform module', (entry) => {
        expect(importsOf(entry).filter((specifier) => !specifier.startsWith('./'))).toEqual([]);
        const code = readFileSync(new URL(entry, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        expect(code).not.toMatch(/\b(?:process|Bun)\./);
    });
});
