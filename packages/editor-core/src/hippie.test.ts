import { describe, expect, test } from 'bun:test';
import { DocumentModel } from './document.ts';
import { hippieMatches } from './hippie.ts';
import type { CommandOptions, EditorCommand } from './types.ts';

/* A model with its caret at the `|`. */
function modelAt(source: string): DocumentModel {
    const caret = source.indexOf('|');
    const model = new DocumentModel(source.replace('|', ''));

    model.setSelections([{ anchor: caret, head: caret }]);

    return model;
}

function press(model: DocumentModel, command: EditorCommand = 'hippieCompletion', options: CommandOptions = {}): string {
    model.execute(command, { language: 'typescript', ...options });

    const caret = model.getPrimary().head;

    return model.getText().slice(0, caret) + '|' + model.getText().slice(caret);
}

describe('hippieMatches', () => {
    test('keeps the first character as typed and ignores the case of the rest', () => {
        expect(hippieMatches('fooBar', 'fo')).toBe(true);
        expect(hippieMatches('fooBar', 'FO')).toBe(false);
        expect(hippieMatches('fooBar', 'fOO')).toBe(true);
    });

    test('jumps to camel humps and to letters after underscores, hyphens and digits', () => {
        expect(hippieMatches('fooBarBaz', 'fbb')).toBe(true);
        expect(hippieMatches('foo_bar', 'fb')).toBe(true);
        expect(hippieMatches('foo-bar', 'fb')).toBe(true);
        expect(hippieMatches('foo1bar', 'fb')).toBe(true);
        expect(hippieMatches('foobar', 'fb')).toBe(false);
    });

    test('wants a longer word', () => {
        expect(hippieMatches('foo', 'foo')).toBe(false);
        expect(hippieMatches('foo', '')).toBe(true);
    });
});

describe('Hippie completion', () => {
    test('completes with the nearest word above the caret and cycles up', () => {
        const model = modelAt('foobar\nfoobaz\nfoo|');

        expect(press(model)).toBe('foobar\nfoobaz\nfoobaz|');
        expect(press(model)).toBe('foobar\nfoobaz\nfoobar|');
    });

    test('goes into the other texts and home again', () => {
        const model = modelAt('fooA\nfoo|');
        const wordSources = () => ['fooB fooC', 'fooD'];

        expect(press(model, 'hippieCompletion', { wordSources })).toBe('fooA\nfooA|');
        expect(press(model, 'hippieCompletion', { wordSources })).toBe('fooA\nfooD|');
        expect(press(model, 'hippieCompletion', { wordSources })).toBe('fooA\nfooC|');
        expect(press(model, 'hippieCompletion', { wordSources })).toBe('fooA\nfooB|');
        expect(press(model, 'hippieCompletion', { wordSources })).toBe('fooA\nfooA|');
    });

    test('backward looks below the caret first and walks down', () => {
        const model = modelAt('foo|\nfooA\nfooB');

        expect(press(model, 'hippieBackwardCompletion')).toBe('fooA|\nfooA\nfooB');
        expect(press(model, 'hippieBackwardCompletion')).toBe('fooB|\nfooA\nfooB');
    });

    test('backward falls back to the first variant when nothing is below', () => {
        const model = modelAt('fooA\nfooB\nfoo|');

        expect(press(model, 'hippieBackwardCompletion')).toBe('fooA\nfooB\nfooA|');
    });

    test('keeps the occurrence nearest the caret of a repeated word', () => {
        const model = modelAt('fooX\nfooY\nfooX\nfoo|');

        expect(press(model)).toBe('fooX\nfooY\nfooX\nfooX|');
        expect(press(model)).toBe('fooX\nfooY\nfooX\nfooY|');
        expect(press(model)).toBe('fooX\nfooY\nfooX\nfooX|');
    });

    test('offers a word on both sides of the caret twice', () => {
        const model = modelAt('fooX\nfoo|\nfooX');

        expect(press(model)).toBe('fooX\nfooX|\nfooX');
        expect(press(model)).toBe('fooX\nfooX|\nfooX');
    });

    test('matches camel humps and skips the word under the caret', () => {
        const model = modelAt('fooBar fb| fbx');

        expect(press(model)).toBe('fooBar fooBar| fbx');
    });

    test('completes every caret relative to its own position', () => {
        const model = new DocumentModel('fooBar\nfo\nfo');

        model.setSelections([
            { anchor: 9, head: 9 },
            { anchor: 12, head: 12 }
        ]);
        model.execute('hippieCompletion', { language: 'typescript' });

        expect(model.getText()).toBe('fooBar\nfooBar\nfooBar');
        expect(model.getSelections().map((selection) => selection.head)).toEqual([13, 20]);
    });

    test('starts over after the caret moved', () => {
        const model = modelAt('fooA\nfooB\nfoo|');

        expect(press(model)).toBe('fooA\nfooB\nfooB|');

        model.setSelections([{ anchor: 12, head: 12 }]);

        expect(press(model)).toBe('fooA\nfooB\nfooB|oB');
    });

    test('changes nothing without a match', () => {
        const model = modelAt('abc\nxyz|');

        expect(model.execute('hippieCompletion', { language: 'typescript' })).toBe(false);
        expect(model.getText()).toBe('abc\nxyz');
    });

    test('joins hyphenated words only where the language has no braces', () => {
        expect(press(modelAt('well-known\nwel|'), 'hippieCompletion', { language: 'markdown' })).toBe('well-known\nwell-known|');
        expect(press(modelAt('well-known\nwel|'), 'hippieCompletion', { language: 'typescript' })).toBe('well-known\nwell|');
    });

    test('reports where the proposal came from and takes it back with one undo', () => {
        const model = modelAt('fooBar\nfoo|');

        press(model);

        expect(model.hippieSource).toEqual({ from: 0, to: 6 });

        model.execute('undo');

        expect(model.getText()).toBe('fooBar\nfoo');
    });

    test('completes an empty prefix with the nearest word', () => {
        expect(press(modelAt('alpha beta |'))).toBe('alpha beta beta|');
    });
});
