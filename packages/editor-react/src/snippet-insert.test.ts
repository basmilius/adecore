import './test-setup.ts';
import { afterEach, describe, expect, test } from 'bun:test';
import { FakeEditorEngine } from '@adecore/editor/fake';
import type { EditorNotification } from './host-types.ts';
import { EditorLanguage } from './editor-language.ts';
import { ProjectLanguage } from './project-language.ts';
import { bodyWithIndentUnit, dedentLines, insertSnippet } from './snippet-insert.ts';
import { FakeLanguageService, ManualTimers } from './testing.ts';

const owners: Array<{ dispose(): void }> = [];

afterEach(() => {
    for (const owner of owners.splice(0).reverse()) {
        owner.dispose();
    }
});

/* A TypeScript editor with a text; `range` makes a range of offsets. */
async function setup(text: string, options: { readOnly?: boolean } = {}) {
    const notifications: EditorNotification[] = [];
    const project = new ProjectLanguage(new FakeLanguageService(), { notify: (notification) => notifications.push(notification) });
    const editor = new FakeEditorEngine().mount({} as HTMLElement, { text, theme: 'light', readOnly: options.readOnly });
    const language = new EditorLanguage(project, editor, 'file:///work/src/a.ts', 'typescript', new ManualTimers());
    owners.push(project, language);
    await language.document.ready;

    const range = (from: number, to = from) => ({ start: editor.positionAt(from), end: editor.positionAt(to) });
    const caret = () => editor.offsetAt(editor.getCaret());

    return { editor, language, notifications, range, caret };
}

describe('insertSnippet', () => {
    test('replaces the range with the snippet and starts a session on its tab stops', async () => {
        const { editor, language, range, caret } = await setup('log');

        expect(await insertSnippet(language, 'console.log(${1:value});$0', [{ range: range(0, 3) }])).toBe(true);
        expect(editor.getText()).toBe('console.log(value);');
        expect(language.snippets.isActive).toBe(true);
        expect(editor.getSelection()).toEqual(range(12, 17));

        language.snippets.end();

        expect(caret()).toBe(17);
    });

    test('puts the caret after the insertion when the snippet has no stops', async () => {
        const { editor, language, range, caret } = await setup('x;');

        expect(await insertSnippet(language, 'one\ntwo', [{ range: range(0, 1) }])).toBe(true);
        expect(editor.getText()).toBe('one\ntwo;');
        expect(language.snippets.isActive).toBe(false);
        expect(caret()).toBe(7);
    });

    test('indents the lines after the first to the text before the range', async () => {
        const { editor, language, range } = await setup('function f() {\n    if\n}');
        const at = editor.getText().indexOf('if');

        await insertSnippet(language, 'if ($1) {\n    $0\n}', [{ range: range(at, at + 2) }]);

        expect(editor.getText()).toBe('function f() {\n    if () {\n        \n    }\n}');
    });

    test('gives the selected text its lines indentation, and lets the extra variables go first', async () => {
        const { editor, language, range } = await setup('a();\nb();');

        await insertSnippet(language, 'if ($1) {\n\t$TM_SELECTED_TEXT\n}\n// $NAME', [{ range: range(0, 9), selectedText: 'a();\nb();' }], (name) =>
            name === 'NAME' ? 'extra' : undefined
        );

        expect(editor.getText()).toBe('if () {\n\ta();\n\tb();\n}\n// extra');
    });

    test('resolves the variables for each placement, and puts a session on every one', async () => {
        const { editor, language, range } = await setup('a\nb');

        await insertSnippet(language, '[${1:x}]$TM_LINE_NUMBER', [{ range: range(0, 1) }, { range: range(2, 3) }]);

        expect(editor.getText()).toBe('[x]1\n[x]2');
        expect(editor.getSelections()).toEqual([range(1, 2), range(6, 7)]);

        language.snippets.end();
    });

    test('goes on in a running session, which takes it as a nested one', async () => {
        const { editor, language, range } = await setup('a b');

        await insertSnippet(language, '(${1:one}) ${2:two}', [{ range: range(0, 1) }]);

        expect(editor.getText()).toBe('(one) two b');

        await insertSnippet(language, '<${1:inner}>', [{ range: editor.getSelection() }]);

        expect(editor.getText()).toBe('(<inner>) two b');
        expect(language.snippets.isActive).toBe(true);

        language.snippets.end();
    });

    test('refuses a snippet that is too large and tells the person', async () => {
        const { editor, language, range, notifications } = await setup('x');

        expect(await insertSnippet(language, 'x'.repeat(90_000), [{ range: range(0, 1) }, ...Array.from({ length: 30 }, () => ({ range: range(0, 1) }))])).toBe(
            false
        );
        expect(editor.getText()).toBe('x');
        expect(notifications.map((notification) => notification.title)).toEqual(['Too large to insert']);
    });

    test('does nothing in a read-only editor or without placements', async () => {
        const { editor, language, range } = await setup('x', { readOnly: true });

        expect(await insertSnippet(language, 'y', [{ range: range(0, 1) }])).toBe(false);
        expect(await insertSnippet(language, 'y', [])).toBe(false);
        expect(editor.getText()).toBe('x');
    });

    test('drops an insertion when the text changed while it waited', async () => {
        const { editor, language, range } = await setup('x');
        const inserting = insertSnippet(language, 'y', [{ range: range(0, 1) }]);

        editor.setText('z');

        expect(await inserting).toBe(false);
        expect(editor.getText()).toBe('z');
    });
});

describe('bodyWithIndentUnit', () => {
    test('turns the leading tabs of each line into the unit', () => {
        expect(bodyWithIndentUnit('a {\n\tb\n\t\tc\n}', '  ')).toBe('a {\n  b\n    c\n}');
        expect(bodyWithIndentUnit('a\tb\n\tc', '\t')).toBe('a\tb\n\tc');
        expect(bodyWithIndentUnit('a\tb', '    ')).toBe('a\tb');
    });
});

describe('dedentLines', () => {
    test('takes the shortest indentation of the lines after the first off them', () => {
        expect(dedentLines('    a\n        b\n    c')).toBe('    a\n    b\nc');
        expect(dedentLines('a\n\n    b\n  c')).toBe('a\n\n  b\nc');
    });

    test('takes the given base off, as far as a line has it', () => {
        expect(dedentLines('a\n    b\n  c', '    ')).toBe('a\nb\nc');
        expect(dedentLines('a\r\n  b', '  ')).toBe('a\r\nb');
        expect(dedentLines('single line')).toBe('single line');
    });
});
