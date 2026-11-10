import { describe, expect, it } from 'bun:test';
import { documentLanguageId, lspLanguageId, lspLanguageIdOf, SCRIPT_LANGUAGE_IDS } from './language-ids.ts';

const IDS: ReadonlyArray<readonly [string, string]> = [
    ['typescript', 'typescript'],
    ['ts', 'typescript'],
    ['mts', 'typescript'],
    ['cts', 'typescript'],
    ['tsx', 'typescriptreact'],
    ['javascript', 'javascript'],
    ['js', 'javascript'],
    ['mjs', 'javascript'],
    ['cjs', 'javascript'],
    ['jsx', 'javascriptreact'],
    ['vue', 'vue'],
    ['php', 'php'],
    ['css', 'css'],
    ['scss', 'scss'],
    ['less', 'less'],
    ['html', 'html'],
    ['json', 'json'],
    ['jsonc', 'jsonc'],
    ['yaml', 'yaml'],
    ['yml', 'yaml'],
    ['python', 'python'],
    ['py', 'python'],
    ['shellscript', 'shellscript'],
    ['sh', 'shellscript'],
    ['bash', 'shellscript'],
    ['zsh', 'shellscript'],
    ['docker', 'dockerfile'],
    ['twig', 'twig'],
    ['sql', 'sql'],
    ['rust', 'rust'],
    ['markdown', 'markdown'],
    ['toml', 'toml'],
    ['lua', 'lua'],
    ['go', 'go'],
    ['swift', 'swift'],
    ['zig', 'zig']
];

describe('the LSP id of a language', () => {
    it.each(IDS)('maps %s to %s', (name, id) => {
        expect(lspLanguageIdOf(name)).toBe(id);
        expect(lspLanguageId(name)).toBe(id);
    });

    it('leaves a language it does not list as it is, or as unknown', () => {
        expect(lspLanguageId('dockerfile')).toBe('dockerfile');
        expect(lspLanguageId('typescriptreact')).toBe('typescriptreact');
        expect(lspLanguageId('unknown')).toBe('unknown');
        expect(lspLanguageIdOf('unknown')).toBeNull();
        expect(lspLanguageIdOf(undefined)).toBeNull();
    });

    it('is the same when applied twice', () => {
        for (const [name] of IDS) {
            expect(lspLanguageId(lspLanguageId(name))).toBe(lspLanguageId(name));
        }
    });

    it('lists the script languages by their LSP ids', () => {
        expect([...SCRIPT_LANGUAGE_IDS].sort()).toEqual(['javascript', 'javascriptreact', 'typescript', 'typescriptreact']);
        expect(SCRIPT_LANGUAGE_IDS.every((id) => lspLanguageId(id) === id)).toBe(true);
    });
});

describe('the language id a document opens with', () => {
    it('opens a JSON file that allows comments as JSONC and any other as JSON', () => {
        expect(documentLanguageId('json', 'tsconfig.json')).toBe('jsonc');
        expect(documentLanguageId('json', 'packages/app/tsconfig.build.json')).toBe('jsonc');
        expect(documentLanguageId('json', '.vscode/settings.json')).toBe('jsonc');
        expect(documentLanguageId('json', 'package.json')).toBe('json');
        expect(documentLanguageId('tsx', 'a.tsx')).toBe('typescriptreact');
    });
});
