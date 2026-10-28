import './test-setup.ts';
import { afterEach, describe, expect, test } from 'bun:test';
import { mountEditor } from '@adecore/editor/testing';
import { EditorLanguage } from './editor-language.ts';
import { ProjectLanguage } from './project-language.ts';
import { BUILT_IN_POSTFIX_TEMPLATES, checkTemplate, TemplateRegistry, type LiveTemplate, type PostfixTemplate, type TemplateSettings } from './templates.ts';
import { FakeLanguageService, ManualTimers } from './testing.ts';

async function settle(): Promise<void> {
    for (let i = 0; i < 6; i++) {
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
}

const open: Array<{ dispose(): void }> = [];

afterEach(() => {
    for (const owner of open.splice(0).reverse()) {
        owner.dispose();
    }
});

interface Options {
    readonly languageId?: string;
    readonly live?: readonly LiveTemplate[];
    readonly postfix?: readonly PostfixTemplate[];
    readonly settings?: TemplateSettings;
}

/* An editor of `languageId` with the caret at the `|` of `marked`. */
async function setup(marked: string, options: Options = {}) {
    const { languageId = 'typescript', live = [], postfix = [], settings } = options;
    const offset = marked.indexOf('|');
    const text = marked.slice(0, offset) + marked.slice(offset + 1);
    const mounted = mountEditor({ text, language: languageId });
    const templates = new TemplateRegistry();
    templates.set({ live, postfix, settings });

    const project = new ProjectLanguage(new FakeLanguageService(), { templates });
    const timers = new ManualTimers();
    const language = new EditorLanguage(project, mounted.editor, `file:///work/file.${languageId}`, languageId, timers, { serve: true });
    open.push(project, language);
    await language.document.ready;
    const caret = mounted.editor.positionAt(offset);
    mounted.editor.setSelection({ start: caret, end: caret });
    await settle();

    const shown = (): string => {
        const at = mounted.editor.offsetAt(mounted.editor.getCaret());
        const current = mounted.editor.getText();

        return `${current.slice(0, at)}|${current.slice(at)}`;
    };

    const tab = async (): Promise<boolean> => {
        const handled = language.templates.expand();

        await settle();

        return handled;
    };

    const typeKeys = async (keys: string): Promise<void> => {
        for (const character of keys) {
            mounted.type(character);
            await settle();
            timers.advance(80);
            await settle();
        }
    };

    const chooser = () => language.popups.getState().pick;

    return { ...mounted, language, templates, shown, tab, typeKeys, chooser };
}

describe('Tab', () => {
    test('wraps the expression in a statement template', async () => {
        const { tab, shown } = await setup('x.if|');

        expect(await tab()).toBe(true);
        expect(shown()).toBe('if (x) {\n    |\n}');
    });

    test('takes the whole chain of members and calls', async () => {
        const { tab, editor } = await setup('a.b(c).d.if|');

        await tab();

        expect(editor.getText()).toBe('if (a.b(c).d) {\n    \n}');
    });

    test('covers a chain over several lines and keeps its indentation', async () => {
        const { tab, editor } = await setup('    foo()\n        .bar.log|');

        await tab();

        expect(editor.getText()).toBe('    console.log(foo()\n        .bar);');
    });

    test('offers the expressions that end at the dot, innermost first, and never a part of a binary one', async () => {
        const unary = await setup('!a.par|');

        await unary.tab();

        expect(unary.chooser()?.title).toBe('Expressions');
        expect(unary.chooser()?.groups[0]!.rows.map((row) => row.label)).toEqual(['a', '!a']);

        const binary = await setup('a * b + c.par|');

        await binary.tab();

        expect(binary.chooser()?.groups[0]!.rows.map((row) => row.label)).toEqual(['c', 'a * b + c']);
    });

    test('applies the expression a person picks', async () => {
        const { tab, language, chooser, editor, shown } = await setup('!a.par|');

        await tab();

        language.pick.choose(chooser()!.groups[0]!.rows[1]!.id);
        await settle();

        expect(editor.getText()).toBe('(!a)');
        expect(shown()).toBe('(!a)|');
    });

    test('is not offered for a statement template where the expression is not a statement', async () => {
        const { tab, editor } = await setup('x = a.if|');

        expect(await tab()).toBe(false);
        expect(editor.getText()).toBe('x = a.if');
    });

    test('ignores a number with a decimal point, and a string or a comment', async () => {
        const number = await setup('1.if|');

        expect(await number.tab()).toBe(false);

        const string = await setup("'a.if|'");

        expect(await string.tab()).toBe(false);

        const comment = await setup('// a.if|');

        expect(await comment.tab()).toBe(false);
    });

    test('takes the variable and the string before a dot in PHP', async () => {
        const { tab, chooser } = await setup("<?php 's'.$v.par|", { languageId: 'php' });

        await tab();

        expect(chooser()?.groups[0]!.rows.map((row) => row.label)).toEqual(['$v', "'s'.$v"]);
    });

    test('does nothing with several carets', async () => {
        const { tab, editor } = await setup('x.if|\ny.if');

        editor.setSelections([
            { start: { line: 0, character: 4 }, end: { line: 0, character: 4 } },
            { start: { line: 1, character: 4 }, end: { line: 1, character: 4 } }
        ]);

        expect(await tab()).toBe(false);
        expect(editor.getText()).toBe('x.if\ny.if');
    });

    test('does nothing when the setting is off', async () => {
        const off = await setup('x.if|', { settings: { postfix: false } });

        expect(await off.tab()).toBe(false);
        expect(off.editor.getText()).toBe('x.if');
    });

    test('wins over a live template whose key starts after the dot', async () => {
        const { tab, editor } = await setup('x.log|');

        await tab();

        expect(editor.getText()).toBe('console.log(x);');
    });

    test('loses to a live template whose key starts before the dot', async () => {
        const live: LiveTemplate[] = [{ id: 'test.xlog', key: 'xlog', body: 'live', languages: ['javascript'] }];
        const { tab, editor } = await setup('xlog|', { live });

        await tab();

        expect(editor.getText()).toBe('live');
    });

    test('lists the templates that share a key', async () => {
        const postfix: PostfixTemplate[] = [
            { id: 'test.one', key: 'dup', body: '1($EXPR)', languages: ['javascript'] },
            { id: 'test.two', key: 'dup', body: '2($EXPR)', languages: ['javascript'] }
        ];

        const { language, editor } = await setup('x.dup|', { postfix });

        expect(language.templates.expand()).toBe(true);
        expect(language.popups.getState().completion?.rows.map((row) => row.label)).toEqual(['dup', 'dup']);

        await language.completion.accept(false, 1);
        await settle();

        expect(editor.getText()).toBe('2(x)');
    });
});

describe('completion rows', () => {
    test('follow a dot, sort after the rows of a service, and expand when accepted', async () => {
        const { typeKeys, language, editor } = await setup('x|');

        await typeKeys('.i');

        const rows = language.popups.getState().completion?.rows ?? [];

        expect(rows.map((row) => row.label)).toContain('if');

        await language.completion.accept(
            false,
            rows.findIndex((row) => row.label === 'if')
        );
        await settle();

        expect(editor.getText()).toBe('if (x) {\n    \n}');
    });

    test('are left out for a statement template where the expression is not a statement', async () => {
        const { typeKeys, language } = await setup('y = x|');

        await typeKeys('.i');

        expect(language.popups.getState().completion?.rows.map((row) => row.label) ?? []).not.toContain('if');
    });

    test('are left out when either setting is off', async () => {
        const rowsOf = async (settings: Options['settings']): Promise<string[]> => {
            const { typeKeys, language } = await setup('x|', { settings });

            await typeKeys('.i');

            return language.popups.getState().completion?.rows.map((row) => row.label) ?? [];
        };

        expect(await rowsOf({ postfix: false })).not.toContain('if');
        expect(await rowsOf({ postfixInCompletion: false })).not.toContain('if');
    });
});

describe('built-in templates', () => {
    test('are valid, carry an example and an id of their language and key', () => {
        for (const template of BUILT_IN_POSTFIX_TEMPLATES) {
            const language = template.languages.includes('php') ? 'php' : 'javascript';

            expect(checkTemplate(template, 'postfix')).toBeNull();
            expect(template.example).toBeTruthy();
            expect(template.id).toBe(`builtin.postfix.${language}.${template.key}`);
        }
    });
});
