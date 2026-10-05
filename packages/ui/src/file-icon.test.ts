import { describe, expect, test } from 'bun:test';
import { fileIconFor, FILE_TREE_ICONS } from './file-icon.ts';

describe('fileIconFor', () => {
    test('picks the icon of the file type, with its hue', () => {
        expect(fileIconFor('apps/client/src/main.tsx')).toBe('seti-blue-react');
        expect(fileIconFor('state/files.ts')).toBe('seti-blue-typescript');
        expect(fileIconFor('index.php')).toBe('seti-purple-php');
        expect(fileIconFor('Main.kt')).toBe('seti-orange-kotlin');
        expect(fileIconFor('logo.png')).toBe('seti-purple-image');
    });

    test('reads the longest extension first', () => {
        expect(fileIconFor('Button.spec.ts')).toBe('seti-orange-typescript');
    });

    test('reads the whole name before a part of it, and a part before the extension', () => {
        expect(fileIconFor('tsconfig.json')).toBe('seti-blue-tsconfig');
        expect(fileIconFor('package.json')).toBe('seti-yellow-json');
        expect(fileIconFor('Dockerfile.dev')).toBe('seti-blue-docker');
    });

    test('gives a dotfile the icon of the tool it configures', () => {
        expect(fileIconFor('.gitignore')).toBe('seti-gray-git');
        expect(fileIconFor('.editorconfig')).toBe('seti-gray-config');
    });

    /* A path that ends in a separator is what the tree calls a directory. */
    test('falls back to the generic file icon for a directory', () => {
        expect(fileIconFor('apps/client/')).toBe('seti-plain-default');
    });

    test('falls back to the generic file icon for a type it does not know', () => {
        expect(fileIconFor('notes.qqq')).toBe('seti-plain-default');
    });
});

describe('FILE_TREE_ICONS', () => {
    /* A rule pointing at a symbol the sprite lacks draws an empty row in the tree. */
    test('points every rule at a symbol in its sprite', () => {
        const symbols = new Set([...(FILE_TREE_ICONS.spriteSheet ?? '').matchAll(/<symbol id="([^"]+)"/g)].map((match) => match[1]));
        const targets = [
            ...Object.values(FILE_TREE_ICONS.byFileName ?? {}),
            ...Object.values(FILE_TREE_ICONS.byFileExtension ?? {}),
            ...Object.values(FILE_TREE_ICONS.byFileNameContains ?? {}),
            ...Object.values(FILE_TREE_ICONS.remap ?? {})
        ];
        expect(targets.filter((target) => typeof target !== 'string' || !symbols.has(target))).toEqual([]);
    });
});
