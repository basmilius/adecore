import './test-setup.ts';
import { afterEach, describe, expect, test } from 'bun:test';
import { mountEditor } from '@adecore/editor/testing';
import { EditorLanguage } from './editor-language.ts';
import type { EditorNotification } from './host-types.ts';
import { ProjectLanguage } from './project-language.ts';
import { TemplateRegistry, type LiveTemplate } from './templates.ts';
import { FakeLanguageService, ManualTimers } from './testing.ts';

async function settle(): Promise<void> {
    for (let i = 0; i < 6; i++) {
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
}

/* Surround With off macOS; Ctrl and Alt together would type a character on some layouts, so a test presses the chord on the code of its key. */
const SURROUND_CHORD = { ctrlKey: true, altKey: true, code: 'KeyT' } as never;
const TEMPLATE_CHORD = { ctrlKey: true, altKey: true, code: 'KeyJ' } as never;

const open: Array<{ dispose(): void }> = [];

afterEach(() => {
    for (const owner of open.splice(0).reverse()) {
        owner.dispose();
    }
});

interface Options {
    readonly languageId?: string;
    readonly live?: readonly LiveTemplate[];
    readonly readOnly?: boolean;
    readonly settings?: boolean;
}

/*
 * An editor of `languageId` over `marked`: `|` is the caret, `«` and `»` a selection, and a second `|` another caret.
 * The markers are left out of the text.
 */
async function setup(marked: string, options: Options = {}) {
    const { languageId = 'typescript', live = [], readOnly = false, settings = false } = options;
    const carets: number[] = [];
    let selection: [number, number] | null = null;
    let text = '';

    for (const character of marked) {
        if (character === '|') {
            carets.push(text.length);
        } else if (character === '«') {
            selection = [text.length, text.length];
        } else if (character === '»' && selection !== null) {
            selection = [selection[0], text.length];
        } else {
            text += character;
        }
    }

    const mounted = mountEditor({ text, language: languageId, readOnly });
    const templates = new TemplateRegistry();
    const notifications: EditorNotification[] = [];
    let configured = 0;
    templates.set({ live });

    const project = new ProjectLanguage(new FakeLanguageService(), {
        templates,
        notify: (notification) => notifications.push(notification),
        ...(settings ? { openTemplateSettings: () => configured++ } : {})
    });

    const timers = new ManualTimers();
    const language = new EditorLanguage(project, mounted.editor, `file:///work/file.${languageId}`, languageId, timers);
    open.push(project, language);
    await language.document.ready;

    const ranges =
        selection === null
            ? carets.map((offset) => ({ start: mounted.editor.positionAt(offset), end: mounted.editor.positionAt(offset) }))
            : [{ start: mounted.editor.positionAt(selection[0]), end: mounted.editor.positionAt(selection[1]) }];

    mounted.editor.setSelections(ranges);
    await settle();

    const rows = () => language.popups.getState().pick?.groups.flatMap((group) => group.rows) ?? [];
    const labels = () => rows().map((row) => `${row.mnemonic ?? ''} ${row.label}`.trim());

    const choose = async (id: string): Promise<void> => {
        language.pick.choose(id);
        await settle();
    };

    const shown = (): string => {
        const at = mounted.editor.offsetAt(mounted.editor.getCaret());
        const current = mounted.editor.getText();

        return `${current.slice(0, at)}|${current.slice(at)}`;
    };

    return { ...mounted, language, timers, notifications, rows, labels, choose, shown, configured: () => configured };
}

describe('Surround With', () => {
    test('surrounds the content of the line when nothing is selected', async () => {
        const { language, choose, shown } = await setup('function run() {\n      foo();  |\n}');

        expect(language.surround.open()).toBe(true);
        await choose('construct:if');

        expect(shown()).toBe('function run() {\n      if (|) {\n          foo();\n      }  \n}');
    });

    test('keeps the relative indentation of a selection of several lines', async () => {
        const { editor, language, choose } = await setup('function run() {\n    «a();\n    if (b) {\n        c();\n    }»\n}');

        language.surround.open();
        await choose('construct:while');

        expect(editor.getText()).toBe('function run() {\n    while () {\n        a();\n        if (b) {\n            c();\n        }\n    }\n}');
    });

    test('lists the statements, the regions and the live templates with a mnemonic each, and takes the second row on 2', async () => {
        const { editor, language, press, labels } = await setup('foo();|');

        language.surround.open();

        expect(labels().slice(0, 4)).toEqual(['1 if', '2 if / else', '3 while', '4 do / while']);
        expect(labels().slice(8, 14)).toEqual(['9 { }', '0 function', 'A region...endregion Comments', 'B <editor-fold...> Comments']);
        expect(language.popups.getState().pick?.title).toBe('Surround With');

        expect(press('2')).toBe(true);
        await settle();

        expect(editor.getText()).toBe('if () {\n    foo();\n} else {\n    \n}');
    });

    test('offers the expression rows for a part of a line only', async () => {
        const whole = await setup('«foo();»');

        whole.language.surround.open();

        expect(whole.rows().map((row) => row.id)).not.toContain('construct:parentheses');

        const part = await setup('const x = «a + b»;');

        part.language.surround.open();

        expect(part.rows().map((row) => row.id)).toEqual(['construct:parentheses', 'construct:not', 'construct:region', 'construct:editorFold']);

        await part.choose('construct:not');

        expect(part.editor.getText()).toBe('const x = !(a + b);');
    });

    test('writes the PHP constructs with their dollar signs', async () => {
        const { editor, language, choose } = await setup('<?php\n«run();»', { languageId: 'php' });

        language.surround.open();
        await choose('construct:foreach');

        expect(editor.getText()).toBe('<?php\nforeach ($array as $value) {\n    run();\n}');
    });

    test('writes a region comment in the comments of the language', async () => {
        const css = await setup('a {\n    «color: red;»\n}', { languageId: 'css' });

        css.language.surround.open();

        expect(css.rows().map((row) => row.id)).toEqual(['construct:region', 'construct:editorFold']);

        await css.choose('construct:region');

        expect(css.editor.getText()).toBe('a {\n    /*region Description*/\n    color: red;\n    /*endregion*/\n}');

        const html = await setup('«<p></p>»', { languageId: 'html' });

        html.language.surround.open();
        await html.choose('construct:editorFold');

        expect(html.editor.getText()).toBe('<!--<editor-fold desc="Description">-->\n<p></p>\n<!--</editor-fold>-->');
    });

    test('previews the lines before and after', async () => {
        const { language, timers } = await setup('function run() {\n    foo();|\n}');

        language.surround.open();
        timers.advance(120);
        await settle();

        expect(language.popups.getState().pick?.preview).toEqual({
            removed: ['    foo();'],
            added: ['    if () {', '        foo();', '    }'],
            note: null
        });
    });

    test('refuses a selection that crosses from the script of a Vue file into its template', async () => {
        const { language, notifications, rows } = await setup('<script>\n«const a = 1;\n</script>\n<template>\n  <p></p>»\n</template>', { languageId: 'vue' });

        expect(language.surround.open()).toBe(true);

        expect(rows()).toEqual([]);
        expect(notifications.map((notification) => notification.title)).toEqual(["Couldn't find Surround With variants applicable to the current context"]);
    });

    test('refuses two carets on one line, and a blank line', async () => {
        const two = await setup('«a(); b();»\n«c();»');

        two.editor.setSelections([
            { start: { line: 0, character: 0 }, end: { line: 0, character: 4 } },
            { start: { line: 0, character: 5 }, end: { line: 0, character: 9 } }
        ]);
        two.language.surround.open();

        expect(two.rows()).toEqual([]);
        expect(two.notifications).toHaveLength(1);

        const blank = await setup('a();\n|\nb();');

        blank.language.surround.open();

        expect(blank.rows()).toEqual([]);
        expect(blank.notifications).toHaveLength(1);
    });

    test('surrounds at every caret, and the fields of the carets are one session', async () => {
        const { editor, language, choose, type } = await setup('a();|\nb();|');

        language.surround.open();
        await choose('construct:if');

        expect(editor.getText()).toBe('if () {\n    a();\n}\nif () {\n    b();\n}');
        expect(editor.getSelections()).toHaveLength(2);

        type('x');

        expect(editor.getText()).toBe('if (x) {\n    a();\n}\nif (x) {\n    b();\n}');
    });

    test('merges overlapping ranges', async () => {
        const { editor, language, choose } = await setup('a();\nb();\nc();');

        editor.setSelections([
            { start: { line: 0, character: 0 }, end: { line: 1, character: 4 } },
            { start: { line: 1, character: 0 }, end: { line: 2, character: 4 } }
        ]);
        language.surround.open();
        await choose('construct:braces');

        expect(editor.getText()).toBe('{\n    a();\n    b();\n    c();\n}');
    });

    test('does nothing in a read-only editor', async () => {
        const { editor, language, rows, notifications } = await setup('foo();|', { readOnly: true });

        expect(language.surround.open()).toBe(true);
        expect(language.surround.openTemplates()).toBe(true);
        expect(language.surround.unwrap()).toBe(true);

        expect(rows()).toEqual([]);
        expect(notifications).toEqual([]);
        expect(editor.getText()).toBe('foo();');
    });

    test('opens on its chord', async () => {
        const { language, press, rows } = await setup('foo();|');

        expect(press('t', SURROUND_CHORD)).toBe(true);
        expect(rows().length).toBeGreaterThan(0);
        expect(language.pick.isOpen).toBe(true);
    });
});

describe('Surround with Live Template', () => {
    const wrap: LiveTemplate = { id: 'own.wrap', key: 'wrap', body: '<b>$TM_SELECTED_TEXT</b>', languages: ['html'], description: 'Bold' };
    const plain: LiveTemplate = { id: 'own.plain', key: 'plain', body: 'plain', languages: ['html'] };

    test('lists Emmet first in markup, then the templates that use the selection and the settings row', async () => {
        const { language, labels, rows } = await setup('«<p></p>»', { languageId: 'html', live: [wrap, plain], settings: true });

        expect(language.surround.openTemplates()).toBe(true);

        expect(labels()).toEqual(['E Emmet', 'T T', 'W wrap', 'Configure live templates…']);
        expect(rows().find((row) => row.id === 'template:own.wrap')?.detail).toBe('Bold');
        expect(language.popups.getState().pick?.title).toBe('Select Template');
    });

    test('puts the live templates in a group of their own below the constructs in Surround With', async () => {
        const { language } = await setup('«<p></p>»', { languageId: 'html', settings: true });

        language.surround.open();

        expect(language.popups.getState().pick?.groups.map((group) => group.title)).toEqual([null, 'Live templates']);
    });

    test('wraps with the T template, its tag mirrored', async () => {
        const { editor, language, choose, type } = await setup('«<p></p>»', { languageId: 'html' });

        language.surround.openTemplates();
        await choose('template:builtin.html.T');

        expect(editor.getText()).toBe('<tag><p></p></tag>');

        type('div');

        expect(editor.getText()).toBe('<div><p></p></div>');
    });

    test('opens the settings from its row', async () => {
        const { language, choose, configured } = await setup('«<p></p>»', { languageId: 'html', settings: true });

        language.surround.openTemplates();
        await choose('configure');

        expect(configured()).toBe(1);
    });

    test('hands the wrapping to the Emmet field', async () => {
        const { language, choose } = await setup('«<p></p>»', { languageId: 'html' });

        language.surround.openTemplates();
        await choose('emmet');

        expect(language.popups.getState().wrap).not.toBeNull();
    });

    test('says so where no template applies', async () => {
        const { language, notifications, rows } = await setup('«foo();»');

        language.surround.openTemplates();

        expect(rows()).toEqual([]);
        expect(notifications.map((notification) => notification.title)).toEqual(['No surround templates defined in this context']);
    });

    test('opens on its chord', async () => {
        const { language, press, rows } = await setup('«<p></p>»', { languageId: 'html' });

        expect(press('j', TEMPLATE_CHORD)).toBe(true);
        expect(rows()[0]?.label).toBe('Emmet');
        expect(language.pick.isOpen).toBe(true);
    });
});
