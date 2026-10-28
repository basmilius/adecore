import './test-setup.ts';
import { afterEach, describe, expect, test } from 'bun:test';
import { mountEditor } from '@adecore/editor/testing';
import { EditorLanguage } from './editor-language.ts';
import { ProjectLanguage } from './project-language.ts';
import { FakeLanguageService, ManualTimers } from './testing.ts';

async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
}

const open: EditorLanguage[] = [];

afterEach(() => {
    for (const language of open.splice(0)) {
        language.dispose();
    }
});

/* An editor of `languageId` with the caret at the `|` of `marked`. */
async function setup(marked: string, languageId = 'html') {
    const offset = marked.indexOf('|');
    const text = marked.slice(0, offset) + marked.slice(offset + 1);
    const mounted = mountEditor({ text, language: languageId });
    const language = new EditorLanguage(
        new ProjectLanguage(new FakeLanguageService()),
        mounted.editor,
        `file:///work/page.${languageId}`,
        languageId,
        new ManualTimers()
    );
    await language.document.ready;
    open.push(language);
    const caret = mounted.editor.positionAt(offset);
    mounted.editor.setSelection({ start: caret, end: caret });
    await settle();
    /* One key per character, as a person types, each followed by what the editor does after it. */
    const type = async (text: string): Promise<void> => {
        for (const character of text) {
            mounted.type(character);
            await settle();
        }
    };
    /* The text with a `|` at the caret. */
    const shown = (): string => {
        const at = mounted.editor.offsetAt(mounted.editor.getCaret());
        const current = mounted.editor.getText();
        return current.slice(0, at) + '|' + current.slice(at);
    };
    const undo = (): boolean => mounted.press('z', { ctrlKey: true });
    return { ...mounted, type, language, shown, undo };
}

describe('Emmet abbreviations', () => {
    test('Tab expands the abbreviation before the caret and puts the caret in its first place', async () => {
        const { press, shown } = await setup('<body>\n    ul>li*2|\n</body>');
        expect(press('Tab')).toBe(true);
        expect(shown()).toBe('<body>\n    <ul>\n        <li>|</li>\n        <li></li>\n    </ul>\n</body>');
        press('Tab');
        expect(shown()).toBe('<body>\n    <ul>\n        <li></li>\n        <li>|</li>\n    </ul>\n</body>');
    });

    test('expands lipsum into its sentence', async () => {
        const { press, editor } = await setup('div>p>lipsum|');
        press('Tab');
        expect(editor.getText()).toMatch(/^<div>\n {4}<p>Lorem\W+ipsum\W+dolor\W+sit\W+amet/);
    });

    test('leaves Tab its own meaning inside a tag, a comment and outside markup', async () => {
        for (const marked of ['<div class|></div>', '<!-- div| -->']) {
            const { press, shown } = await setup(marked);
            press('Tab');
            expect(shown()).not.toContain('<div></div>');
        }
        const script = await setup('div|', 'typescript');
        script.press('Tab');
        expect(script.editor.getText()).not.toContain('<div>');
    });

    test('tells where the abbreviation starts without expanding it, under the conditions where Tab expands', async () => {
        const { editor, language } = await setup('<body>\n    ul>li*2|\n</body>');
        expect(language.markup.abbreviationAt()).toEqual({ line: 1, character: 4 });
        expect(editor.getText()).toBe('<body>\n    ul>li*2\n</body>');
        editor.setSelection({ start: { line: 1, character: 4 }, end: { line: 1, character: 8 } });
        expect(language.markup.abbreviationAt()).toBeNull();
        language.markup.configure({ emmet: false });
        editor.setCaret({ line: 1, character: 10 });
        expect(language.markup.abbreviationAt()).toBeNull();

        const attribute = await setup('<div class|></div>');
        expect(attribute.language.markup.abbreviationAt()).toBeNull();
    });

    test('is off once the host turns it off', async () => {
        const { press, editor, language } = await setup('div|');
        language.markup.configure({ emmet: false });
        press('Tab');
        expect(editor.getText()).not.toContain('<div>');
    });

    test('wraps the selection in an abbreviation, its lines one per repeated element', async () => {
        const { editor, language } = await setup('|<body>\n    one\n    two\n</body>');
        editor.setSelection({ start: { line: 1, character: 4 }, end: { line: 2, character: 7 } });
        expect(language.markup.startWrap()).toBe(true);
        expect(language.popups.getState().wrap?.anchor).toEqual({ line: 1, character: 4 });
        expect(language.markup.submitWrap('ul>li*')).toBe(true);
        expect(editor.getText()).toBe('<body>\n    <ul>\n        <li>one</li>\n        <li>two</li>\n    </ul>\n</body>');
        expect(language.popups.getState().wrap).toBeNull();
    });

    test('keeps the field open with a reason when the abbreviation does not expand', async () => {
        const { editor, language } = await setup('text|');
        language.markup.startWrap();
        expect(language.markup.submitWrap('div>>')).toBe(false);
        expect(language.popups.getState().wrap?.error).toBe('Not an abbreviation');
        expect(editor.getText()).toBe('text');
    });
});

describe('closing tags', () => {
    test('the > of a start tag adds its end tag after the caret, in the same undo step', async () => {
        const { type, shown, undo } = await setup('<section>\n    |\n</section>');
        await type('<div class="a">');
        expect(shown()).toBe('<section>\n    <div class="a">|</div>\n</section>');
        undo();
        expect(shown()).not.toContain('</div>');
    });

    test('adds nothing after a void element, a self-closing tag, a > in a value or in text', async () => {
        for (const typed of ['<br>', '<img src="x"/>', '<a title="x>', 'a > b']) {
            const { type, editor } = await setup('|');
            await type(typed);
            expect(editor.getText()).not.toMatch(/<\/(br|img|a)>/);
        }
    });

    test('</ writes the end tag of the innermost open element', async () => {
        const { type, shown } = await setup('<ul>\n    <li>one|');
        await type('</');
        expect(shown()).toBe('<ul>\n    <li>one</li>|');
    });

    test('works in the markup of PHP and never in its code', async () => {
        const markup = await setup('<?php $a = 1; ?>\n|', 'php');
        await markup.type('<p>');
        expect(markup.shown()).toBe('<?php $a = 1; ?>\n<p>|</p>');
        const code = await setup('<?php if ($a |', 'php');
        await code.type('>');
        expect(code.editor.getText()).toBe('<?php if ($a >');
    });
});

describe('linked tags', () => {
    test('a change of the start tag name changes the end tag with it, and one undo takes both back', async () => {
        const { type, editor, undo } = await setup('<div|>text</div>');
        await type('x');
        expect(editor.getText()).toBe('<divx>text</divx>');
        undo();
        expect(editor.getText()).toBe('<div>text</div>');
    });

    test('follows a name typed into the end tag back to the start tag', async () => {
        const { type, press, editor } = await setup('<span>a</sp|an>');
        press('Backspace');
        press('Backspace');
        await type('e');
        expect(editor.getText()).toBe('<ean>a</ean>');
    });

    test('stops at a space, which starts the attributes', async () => {
        const { type, editor } = await setup('<div|></div>');
        await type(' id');
        expect(editor.getText()).toBe('<div id></div>');
    });
});
