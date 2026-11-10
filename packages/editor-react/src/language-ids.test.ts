import { describe, expect, test } from 'bun:test';
import { lspLanguageIdOf } from '@adecore/lsp';
import { shikiLanguageOf, shikiLanguageOfPath } from './language-ids.ts';

describe('the highlighter id of a path', () => {
    test('a .sql path is highlighted as sql', () => {
        expect(shikiLanguageOfPath('db/schema.SQL')).toBe('sql');
    });

    test('a .rs path is highlighted as rust', () => {
        expect(shikiLanguageOfPath('src/main.rs')).toBe('rust');
    });

    test('a path with an unknown extension is plain text', () => {
        expect(shikiLanguageOfPath('notes.unknown')).toBe('text');
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

describe('the highlighter id of an LSP id', () => {
    test('is the id itself except for the React flavors', () => {
        expect(shikiLanguageOf('typescriptreact')).toBe('tsx');
        expect(shikiLanguageOf('javascriptreact')).toBe('jsx');
        expect(shikiLanguageOf('php')).toBe('php');
    });
});
