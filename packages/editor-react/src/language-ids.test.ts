import { describe, expect, test } from 'bun:test';
import { shikiLanguageOf, shikiLanguageOfPath } from './language-ids.ts';

describe('the highlighter id of a path', () => {
    test('a .sql path is highlighted as sql', () => {
        expect(shikiLanguageOfPath('db/schema.SQL')).toBe('sql');
    });

    test('a .rs path is highlighted as rust', () => {
        expect(shikiLanguageOfPath('src/main.rs')).toBe('rust');
    });

    test('a path with an unknown extension is plain text', () => {
        expect(shikiLanguageOfPath('notes.zig')).toBe('text');
    });
});

describe('the highlighter id of an LSP id', () => {
    test('is the id itself except for the React flavors', () => {
        expect(shikiLanguageOf('typescriptreact')).toBe('tsx');
        expect(shikiLanguageOf('javascriptreact')).toBe('jsx');
        expect(shikiLanguageOf('php')).toBe('php');
    });
});
