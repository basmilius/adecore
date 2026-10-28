import './test-setup.ts';
import { afterEach, describe, expect, test } from 'bun:test';
import { mountEditor } from '@adecore/editor/testing';
import { EditorLanguage } from './editor-language.ts';
import type { EditorNotification } from './host-types.ts';
import { ProjectLanguage } from './project-language.ts';
import { TemplateRegistry, type LiveTemplate, type LiveTemplateDraft } from './templates.ts';
import { FakeLanguageService, ManualTimers } from './testing.ts';

async function settle(): Promise<void> {
    for (let i = 0; i < 6; i++) {
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
}

/* Insert Live Template off macOS; a letter chord matches on the code of its key. */
const INSERT_CHORD = { ctrlKey: true, code: 'KeyJ' } as never;

const open: Array<{ dispose(): void }> = [];

afterEach(() => {
    for (const owner of open.splice(0).reverse()) {
        owner.dispose();
    }
});

function template(key: string, extra: Partial<LiveTemplate> = {}): LiveTemplate {
    return { id: `test.${key}`, key, body: `<${key}>$0`, languages: ['javascript'], ...extra };
}

interface Options {
    readonly languageId?: string;
    readonly live?: readonly LiveTemplate[];
    readonly builtins?: boolean;
    readonly readOnly?: boolean;
}

/* An editor of `languageId` with the caret at the `|` of `marked`. */
async function setup(marked: string, options: Options = {}) {
    const { languageId = 'typescript', live = [], builtins = true, readOnly = false } = options;
    const offset = marked.indexOf('|');
    const text = marked.slice(0, offset) + marked.slice(offset + 1);
    const mounted = mountEditor({ text, language: languageId, readOnly });
    const templates = new TemplateRegistry({ builtins });
    const notifications: EditorNotification[] = [];
    const drafts: LiveTemplateDraft[] = [];
    templates.set({ live });

    const project = new ProjectLanguage(new FakeLanguageService(), {
        templates,
        notify: (notification) => notifications.push(notification),
        saveAsLiveTemplate: (draft) => drafts.push(draft)
    });

    const timers = new ManualTimers();
    const language = new EditorLanguage(project, mounted.editor, `file:///work/file.${languageId}`, languageId, timers, { serve: languageId !== 'plaintext' });
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

    const typeKeys = async (keys: string): Promise<void> => {
        for (const character of keys) {
            mounted.type(character);
            await settle();
            timers.advance(80);
            await settle();
        }
    };

    return { ...mounted, language, templates, notifications, drafts, shown, timers, typeKeys };
}

describe('Tab', () => {
    test('expands the key before the caret and puts the caret in the first place', async () => {
        const { press, shown, language } = await setup('log|');

        expect(press('Tab')).toBe(true);
        await settle();

        expect(shown()).toBe('console.log(|);');
        expect(language.snippets.isActive).toBe(false);
    });

    test('goes through the places of the template, and leaves it at the last', async () => {
        const { press, shown, language } = await setup('iter|');

        press('Tab');
        await settle();

        expect(shown()).toBe('for (const item| of iterable) {\n    \n}');
        expect(language.snippets.isActive).toBe(true);

        press('Tab');
        press('Tab');

        expect(shown()).toBe('for (const item of iterable) {\n    |\n}');
        expect(language.snippets.isActive).toBe(false);
    });

    test('ignores a key that starts in the middle of a word, and takes one after a dot', async () => {
        const word = await setup('xlog|');

        expect(word.language.templates.expand()).toBe(false);
        expect(word.editor.getText()).toBe('xlog');

        const member = await setup('x.log|');

        expect(member.press('Tab')).toBe(true);
        await settle();

        expect(member.editor.getText()).toBe('x.console.log();');
    });

    test('takes the longest key, and tries no shorter one when the longest applies nowhere', async () => {
        const longest = await setup('ge|', { builtins: false, live: [template('e'), template('ge')] });

        longest.press('Tab');
        await settle();

        expect(longest.editor.getText()).toBe('<ge>');

        const nothing = await setup('a.x|', { builtins: false, live: [template('x'), template('.x', { places: ['comment'] })] });

        expect(nothing.language.templates.expand()).toBe(false);
        expect(nothing.editor.getText()).toBe('a.x');
    });

    test('does nothing in a comment or a string unless the template applies there', async () => {
        const live = [template('todo', { places: ['comment'] }), template('name')];
        const comment = await setup('// todo|', { builtins: false, live });

        comment.press('Tab');
        await settle();

        expect(comment.editor.getText()).toBe('// <todo>');

        const string = await setup("'name|'", { builtins: false, live });

        expect(string.language.templates.expand()).toBe(false);

        const code = await setup('todo|', { builtins: false, live });

        expect(code.language.templates.expand()).toBe(false);
    });

    test('uses the language of the region in a Vue file', async () => {
        const script = await setup('<script setup lang="ts">\nlog|\n</script>\n<template>\n  <p></p>\n</template>', { languageId: 'vue' });

        expect(script.press('Tab')).toBe(true);
        await settle();

        expect(script.editor.getText()).toContain('console.log();');

        const markup = await setup('<script setup lang="ts">\n</script>\n<template>\n  log|\n</template>', { languageId: 'vue' });

        expect(markup.language.templates.expand()).toBe(false);

        const html = await setup('<script setup lang="ts">\n</script>\n<template>\n  ;t|\n</template>', {
            languageId: 'vue',
            builtins: false,
            live: [template(';t', { languages: ['html'] })]
        });

        html.press('Tab');
        await settle();

        expect(html.editor.getText()).toContain('  <;t>\n');
    });

    test('expands in the code of PHP and not in its markup', async () => {
        const code = await setup('<?php\nfore|', { languageId: 'php' });

        expect(code.press('Tab')).toBe(true);
        await settle();

        expect(code.editor.getText()).toBe('<?php\nforeach ($iterable as $value) {\n    \n}');

        const markup = await setup('<p>fore|</p>', { languageId: 'php' });

        expect(markup.language.templates.expand()).toBe(false);
    });

    test('leaves an Emmet abbreviation to the markup feature, unless a key starts before it', async () => {
        const emmet = await setup('div|', { languageId: 'html' });

        expect(emmet.press('Tab')).toBe(true);
        expect(emmet.editor.getText()).toBe('<div></div>');

        const earlier = await setup(';div|', { languageId: 'html', builtins: false, live: [template(';div', { languages: ['html'] })] });

        earlier.press('Tab');
        await settle();

        expect(earlier.editor.getText()).toBe('<;div>');
    });

    test('lists the templates that share a key', async () => {
        const { press, language, editor } = await setup('lg|', {
            builtins: false,
            live: [template('lg'), { ...template('lg'), id: 'test.second', body: 'second' }]
        });

        expect(press('Tab')).toBe(true);
        expect(language.completion.isOpen).toBe(true);
        expect(language.popups.getState().completion?.rows.map((row) => row.label)).toEqual(['lg', 'lg']);

        await language.completion.accept(false, 1);
        await settle();

        expect(editor.getText()).toBe('second');
    });

    test('expands at every caret, and falls through when one caret lacks the key', async () => {
        const all = await setup('log\nlog|');

        all.editor.setSelections([
            { start: { line: 0, character: 3 }, end: { line: 0, character: 3 } },
            { start: { line: 1, character: 3 }, end: { line: 1, character: 3 } }
        ]);

        expect(all.press('Tab')).toBe(true);
        await settle();

        expect(all.editor.getText()).toBe('console.log();\nconsole.log();');
        expect(all.editor.getSelections()).toHaveLength(2);

        const some = await setup('log\nx|');

        some.editor.setSelections([
            { start: { line: 0, character: 3 }, end: { line: 0, character: 3 } },
            { start: { line: 1, character: 1 }, end: { line: 1, character: 1 } }
        ]);

        expect(some.language.templates.expand()).toBe(false);
        expect(some.editor.getText()).toBe('log\nx');
    });

    test('falls through for a selection and for a read-only editor', async () => {
        const selected = await setup('log|');

        selected.editor.setSelection({ start: { line: 0, character: 0 }, end: { line: 0, character: 3 } });

        expect(selected.language.templates.expand()).toBe(false);

        const readOnly = await setup('log|', { readOnly: true });

        expect(readOnly.language.templates.expand()).toBe(false);
        expect(readOnly.editor.getText()).toBe('log');
    });
});

describe('completion rows', () => {
    test('show in an unserved document for a template of its language only', async () => {
        const live = [template('todo', { languages: ['other'] }), template('tag', { languages: ['javascript'] })];
        const other = await setup('|', { languageId: 'plaintext', builtins: false, live });

        await other.typeKeys('t');

        expect(other.language.popups.getState().completion?.rows.map((row) => row.label)).toEqual(['todo']);

        await other.language.completion.accept(false);
        await settle();

        expect(other.editor.getText()).toBe('<todo>');
    });

    test('are left out when the setting is off', async () => {
        const { typeKeys, language, templates } = await setup('|', { languageId: 'plaintext', builtins: false });

        templates.set({ live: [template('todo', { languages: ['other'] })], settings: { liveInCompletion: false } });
        await typeKeys('t');

        expect(language.completion.isOpen).toBe(false);
    });
});

describe('Insert Live Template', () => {
    test('lists every template that applies when none fits the word before the caret', async () => {
        const { press, language } = await setup('|', { builtins: false, live: [template('bb'), template('aa'), template('cc', { languages: ['php'] })] });

        expect(press('j', INSERT_CHORD)).toBe(true);
        expect(language.popups.getState().completion?.rows.map((row) => row.label)).toEqual(['aa', 'bb']);
    });

    test('narrows the list to the templates that fit the word', async () => {
        const { press, language } = await setup('it|');

        press('j', INSERT_CHORD);

        expect(language.popups.getState().completion?.rows.map((row) => row.label)).toEqual(['itar', 'iter', 'itin', 'ritar']);
    });

    test('includes a template whose description holds the word', async () => {
        const { press, language } = await setup('reverse|');

        press('j', INSERT_CHORD);

        expect(language.popups.getState().completion?.rows.map((row) => row.label)).toEqual(['ritar']);
    });

    test('tells the person when nothing applies', async () => {
        const { press, notifications } = await setup('|', { languageId: 'plaintext' });

        expect(press('j', INSERT_CHORD)).toBe(true);
        expect(notifications).toEqual([{ id: 'language-templates', kind: 'error', title: 'No templates defined in this context' }]);
    });

    test('replaces the selection and hands it to the template', async () => {
        const { press, editor, language } = await setup('<div>\n    a\n    b\n</div>|', { languageId: 'html' });

        editor.setSelection({ start: { line: 1, character: 4 }, end: { line: 2, character: 5 } });
        press('j', INSERT_CHORD);
        await language.completion.accept(false, 0);
        await settle();

        expect(editor.getText()).toBe('<div>\n    <tag>a\n    b</tag>\n</div>');
    });

    test('does nothing in a read-only editor', async () => {
        const { press, language } = await setup('|', { readOnly: true });

        expect(press('j', INSERT_CHORD)).toBe(true);
        expect(language.completion.isOpen).toBe(false);
    });
});

describe('Save as Live Template', () => {
    test('hands the host the dedented selection with its dollar signs escaped', async () => {
        const { editor, language, drafts } = await setup('if (x) {\n    run(`${a}`);\n    done();\n}|');

        editor.setSelection({ start: { line: 1, character: 4 }, end: { line: 2, character: 11 } });

        expect(language.templates.saveSelection()).toBe(true);
        expect(drafts).toEqual([{ body: 'run(`\\${a\\}`);\ndone();', languages: ['javascript'], places: ['code'] }]);
    });

    test('announces that a selection is needed', async () => {
        const { language, drafts } = await setup('log|');

        expect(language.templates.saveSelection()).toBe(false);
        expect(drafts).toEqual([]);
    });
});
