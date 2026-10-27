import { describe, expect, it } from 'bun:test';
import { DocumentModel } from './document.ts';
import { findTodos } from './todo.ts';

function marked(text: string, language: string, words?: readonly string[]): string[] {
    return findTodos(text, language, words === undefined ? {} : { words }).map((match) => text.slice(match.from, match.to));
}

describe('findTodos', () => {
    it('finds TODO and FIXME in any case as whole words, to the end of the comment line', () => {
        expect(marked('const a = 1; // TODO: rename this\n// fixme later\n// todos are not one', 'typescript')).toEqual(['TODO: rename this', 'fixme later']);
    });

    it('starts at the word wherever it stands in the comment', () => {
        expect(marked('// rename this, TODO', 'typescript')).toEqual(['TODO']);
    });

    it('stops a block comment at its closer and takes each line of it on its own', () => {
        expect(marked('/* TODO one */ code();\n/*\n * FIXME two\n */', 'typescript')).toEqual(['TODO one ', 'FIXME two']);
    });

    it('ignores the words in code and in strings', () => {
        expect(marked('const TODO = "TODO: no";\nTODO();', 'typescript')).toEqual([]);
    });

    it('reads the comments of the language', () => {
        expect(marked('# TODO python\nx = "# TODO"', 'python')).toEqual(['TODO python']);
        expect(marked('SELECT 1; -- FIXME sql', 'sql')).toEqual(['FIXME sql']);
        expect(marked('<!-- TODO html --> <p>TODO</p>', 'html')).toEqual(['TODO html ']);
    });

    it('takes a second word in the same comment as part of the first', () => {
        const matches = findTodos('// TODO a FIXME b', 'typescript');

        expect(matches).toEqual([{ from: 3, to: 17, line: 0, word: 'TODO' }]);
    });

    it('uses the words a host gives, and finds nothing with none', () => {
        expect(marked('// TODO a\n// HACK b', 'typescript', ['hack'])).toEqual(['HACK b']);
        expect(findTodos('// TODO a', 'typescript', { words: [] })).toEqual([]);
    });

    it('names the word of the list it matched', () => {
        expect(findTodos('// fixme', 'typescript').map((match) => match.word)).toEqual(['FIXME']);
    });
});

describe('DocumentModel.findTodos', () => {
    it('follows edits and reads only the lines asked for', () => {
        const model = new DocumentModel('a();\n// TODO one\nb();\n// TODO two');

        expect(model.findTodos('typescript', {}, 2, 3).map((match) => match.line)).toEqual([3]);

        model.applyEdits([{ from: 0, to: 0, text: '/*\n' }]);

        expect(model.findTodos('typescript').map((match) => match.line)).toEqual([2, 4]);
        expect(model.findTodos('typescript').map((match) => model.slice(match.from, match.to))).toEqual(['TODO one', 'TODO two']);
    });
});
