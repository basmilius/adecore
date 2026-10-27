import './test-setup.ts';
import { afterEach, describe, expect, test } from 'bun:test';
import { FakeEditorEngine } from '@adecore/editor/fake';
import { EditorLanguage } from './editor-language.ts';
import { ClipboardHistory } from './clipboard-history.ts';
import { ProjectLanguage } from './project-language.ts';
import { keyOf } from './test-support.ts';
import { FakeLanguageService, ManualTimers } from './testing.ts';

const uri = 'file:///work/a.txt';

const open: Array<{ dispose(): void }> = [];

afterEach(() => {
    for (const owner of open.splice(0).reverse()) {
        owner.dispose();
    }
});

function setup(text = 'ab\ncd', options: { readOnly?: boolean; clipboard?: ClipboardHistory } = {}) {
    const clipboard = options.clipboard ?? new ClipboardHistory({ clock: () => 0 });
    const project = new ProjectLanguage(new FakeLanguageService(), { clipboard });
    const editor = new FakeEditorEngine().mount({} as HTMLElement, { text, theme: 'light', readOnly: options.readOnly });
    const timers = new ManualTimers();
    const language = new EditorLanguage(project, editor, uri, 'plaintext', timers, { serve: false });
    open.push(project, language);

    const view = () => language.popups.getState().pick!;
    const labels = () => view().groups[0]!.rows.map((row) => row.label);
    const press = (key: string, modifiers: { shiftKey?: boolean } = {}) => editor.press({ key, ...modifiers });

    return { clipboard, project, editor, language, timers, view, labels, press };
}

describe('capturing copies', () => {
    test('keeps what the editors of a project copy and cut, with whether it was whole lines', () => {
        const { editor, clipboard } = setup();

        editor.copy('one');
        editor.copy('two\n', true, true);

        expect(clipboard.entries.map(({ text, wholeLines }) => ({ text, wholeLines }))).toEqual([
            { text: 'two\n', wholeLines: true },
            { text: 'one', wholeLines: false }
        ]);
    });

    test('stops capturing when the editor lets go of its document', () => {
        const { editor, language, clipboard } = setup();

        language.dispose();
        editor.copy('late');

        expect(clipboard.entries).toEqual([]);
    });

    test('shares one history between the editors of a project', () => {
        const { project, editor } = setup();
        const other = new FakeEditorEngine().mount({} as HTMLElement, { text: '', theme: 'light' });
        const second = new EditorLanguage(project, other, 'file:///work/b.txt', 'plaintext', new ManualTimers(), { serve: false });
        open.push(second);

        editor.copy('from the first');
        other.copy('from the second');

        expect(project.clipboard.entries.map((entry) => entry.text)).toEqual(['from the second', 'from the first']);
    });
});

describe('opening', () => {
    test('lists the copies newest first on one line each, with the first active', () => {
        const { editor, language, clipboard, view, labels } = setup();

        clipboard.add('first');
        clipboard.add('line one\nline two');
        clipboard.add('x'.repeat(100));
        editor.press(keyOf(language.shortcuts.pasteFromHistory));

        expect(view().title).toBe('Choose Content to Paste');
        expect(labels()).toEqual([`${'x'.repeat(80)}…`, 'line one⏎line two', 'first']);
        expect(view().active).toBe(view().groups[0]!.rows[0]!.id);
    });

    test('says so when nothing was copied and opens nothing', () => {
        const { editor, language } = setup();

        expect(editor.press(keyOf(language.shortcuts.pasteFromHistory))).toBe(true);
        expect(editor.announcements).toEqual(['Nothing was copied yet']);
        expect(language.pick.isOpen).toBe(false);
    });

    test('shows the whole text of the active entry as plain lines', async () => {
        const { clipboard, language, timers, view } = setup();

        clipboard.add('one\ntwo');
        language.pasteHistory.open();
        timers.advance(120);
        await Promise.resolve();
        await Promise.resolve();

        expect(view().preview).toEqual({ removed: [], added: ['one', 'two'], note: null, kind: 'text' });
    });
});

describe('choosing', () => {
    test('narrows the list by what is typed', () => {
        const { clipboard, language, view, labels, press } = setup();

        clipboard.add('alpha');
        clipboard.add('beta');
        language.pasteHistory.open();
        press('A');
        press('L');

        expect(labels()).toEqual(['alpha']);
        expect(view().query).toBe('AL');
    });

    test('pastes the chosen entry at the caret and moves it to the top', () => {
        const { clipboard, editor, language, press } = setup('ab\ncd');

        clipboard.add('one');
        clipboard.add('two');
        editor.setCaret({ line: 0, character: 1 });
        language.pasteHistory.open();
        press('ArrowDown');
        press('Enter');

        expect(editor.getText()).toBe('aoneb\ncd');
        expect(clipboard.entries.map((entry) => entry.text)).toEqual(['one', 'two']);
        expect(language.pick.isOpen).toBe(false);
    });

    test('joins several chosen entries in list order with line breaks and keeps the result as a copy of its own', () => {
        const { clipboard, editor, language, press } = setup('');

        clipboard.add('one');
        clipboard.add('two');
        clipboard.add('three');
        language.pasteHistory.open();
        press('ArrowDown', { shiftKey: true });
        press('Enter');

        expect(editor.getText()).toBe('three\ntwo');
        expect(clipboard.entries.map((entry) => entry.text)).toEqual(['three\ntwo', 'three', 'two', 'one']);
    });

    test('a click takes the entry alone', () => {
        const { clipboard, editor, language, view } = setup('');

        clipboard.add('one');
        clipboard.add('two');
        language.pasteHistory.open();
        language.pick.choose(view().groups[0]!.rows[1]!.id);

        expect(editor.getText()).toBe('one');
    });

    test('forgets an entry with Delete and lands on the next one', () => {
        const { clipboard, language, labels, view, press } = setup();

        clipboard.add('one');
        clipboard.add('two');
        clipboard.add('three');
        language.pasteHistory.open();
        press('ArrowDown');
        press('Delete');

        expect(clipboard.entries.map((entry) => entry.text)).toEqual(['three', 'one']);
        expect(labels()).toEqual(['three', 'one']);
        expect(view().active).toBe(view().groups[0]!.rows[1]!.id);
    });

    test('closes once the last entry is forgotten', () => {
        const { clipboard, language, press } = setup();

        clipboard.add('one');
        language.pasteHistory.open();
        press('Delete');

        expect(clipboard.entries).toEqual([]);
        expect(language.pick.isOpen).toBe(false);
    });
});

describe('pasting', () => {
    test('asks the editor to paste it, as a paste from the clipboard', () => {
        const { clipboard, editor, language, press } = setup('x');

        clipboard.add('text');
        language.pasteHistory.open();
        press('Enter');

        expect(editor.pastes).toEqual([{ text: 'text', options: { wholeLines: false } }]);
    });

    test('puts one line on each caret when the entry has as many lines as there are carets', () => {
        const { clipboard, editor, language, press } = setup('a\nb');

        clipboard.add('1\n2');
        editor.setSelections([
            { start: { line: 0, character: 1 }, end: { line: 0, character: 1 } },
            { start: { line: 1, character: 1 }, end: { line: 1, character: 1 } }
        ]);
        language.pasteHistory.open();
        press('Enter');

        expect(editor.getText()).toBe('a1\nb2');
    });

    test('pastes the entry of a copy of bare carets as whole lines', () => {
        const { editor, language, press } = setup('ab');

        editor.copy('line\n', true);
        language.pasteHistory.open();
        press('Enter');

        expect(editor.pastes.at(-1)).toEqual({ text: 'line\n', options: { wholeLines: true } });
    });

    test('pastes joined entries as plain text, never as whole lines', () => {
        const { editor, language, press } = setup('ab');

        editor.copy('one\n', true);
        editor.copy('two\n', true);
        language.pasteHistory.open();
        press('ArrowDown', { shiftKey: true });
        press('Enter');

        expect(editor.pastes.at(-1)).toEqual({ text: 'two\n\none\n', options: { wholeLines: false } });
    });

    test('is refused in a read-only editor', () => {
        const { clipboard, editor, language, press } = setup('ab', { readOnly: true });

        clipboard.add('text');
        language.pasteHistory.open();
        press('Enter');

        expect(editor.getText()).toBe('ab');
    });
});
