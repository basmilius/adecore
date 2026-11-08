import { describe, expect, test } from 'bun:test';
import { lspLanguageIdOf, shikiLanguageOfPath } from './language-ids.ts';

describe('SQL', () => {
    test('a sql file gets the sql language id', () => {
        expect(lspLanguageIdOf('sql')).toBe('sql');
    });

    test('a .sql path is highlighted as sql', () => {
        expect(shikiLanguageOfPath('db/schema.SQL')).toBe('sql');
    });
});

describe('Rust', () => {
    test('a rust file gets the rust language id', () => {
        expect(lspLanguageIdOf('rust')).toBe('rust');
    });

    test('a .rs path is highlighted as rust', () => {
        expect(shikiLanguageOfPath('src/main.rs')).toBe('rust');
    });
});

describe('the language of the catalog', () => {
    test('is found by the highlighter id of the file', () => {
        expect(lspLanguageIdOf('css')).toBe('css');
        expect(lspLanguageIdOf('docker')).toBe('dockerfile');
        expect(lspLanguageIdOf('shellscript')).toBe('shellscript');
        expect(lspLanguageIdOf('twig')).toBe('twig');
        expect(lspLanguageIdOf('unknown')).toBeNull();
        expect(lspLanguageIdOf(undefined)).toBeNull();
    });

    test.each(['markdown', 'toml', 'lua', 'go', 'swift', 'zig'])('gives %s the language id of its own name', (language) => {
        expect(lspLanguageIdOf(language)).toBe(language);
    });

    test.each([
        ['docs/README.md', 'markdown'],
        ['Cargo.toml', 'toml'],
        ['init.LUA', 'lua'],
        ['cmd/main.go', 'go'],
        ['Sources/App.swift', 'swift'],
        ['src/main.zig', 'zig']
    ])('finds the language id of %s by its path', (path, language) => {
        expect(shikiLanguageOfPath(path)).toBe(language);
        expect(lspLanguageIdOf(shikiLanguageOfPath(path))).toBe(language);
    });

    test('leaves the files that only a path of its own names to the host', () => {
        expect(shikiLanguageOfPath('go.mod')).toBe('text');
        expect(shikiLanguageOfPath('build.zon')).toBe('text');
    });
});
