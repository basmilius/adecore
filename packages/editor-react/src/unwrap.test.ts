import './test-setup.ts';
import { afterEach, describe, expect, test } from 'bun:test';
import { mountEditor } from '@adecore/editor/testing';
import { EditorLanguage } from './editor-language.ts';
import { ProjectLanguage } from './project-language.ts';
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

/* An editor of `languageId` over `marked`, whose `|` is the caret and is left out of the text. */
async function setup(marked: string, languageId = 'typescript') {
    const offset = marked.indexOf('|');
    const mounted = mountEditor({ text: marked.slice(0, offset) + marked.slice(offset + 1), language: languageId });
    const project = new ProjectLanguage(new FakeLanguageService());
    const timers = new ManualTimers();
    const language = new EditorLanguage(project, mounted.editor, `file:///work/file.${languageId}`, languageId, timers);
    open.push(project, language);
    await language.document.ready;
    mounted.editor.setCaret(mounted.editor.positionAt(offset));
    await settle();

    const labels = () =>
        language.popups
            .getState()
            .pick?.groups.flatMap((group) => group.rows)
            .map((row) => row.label) ?? [];

    const choose = async (label: string): Promise<void> => {
        const row = language.popups
            .getState()
            .pick?.groups.flatMap((group) => group.rows)
            .find((candidate) => candidate.label === label);

        language.pick.choose(row!.id);
        await settle();
    };

    const shown = (): string => {
        const at = mounted.editor.offsetAt(mounted.editor.getCaret());
        const current = mounted.editor.getText();

        return `${current.slice(0, at)}|${current.slice(at)}`;
    };

    return { ...mounted, language, timers, labels, choose, shown };
}

describe('Unwrap/Remove', () => {
    test('keeps the body of an if and the caret on the same text', async () => {
        const { language, labels, choose, shown } = await setup('run();\nif (a) {\n    do|Work();\n}\nend();');

        expect(language.surround.unwrap()).toBe(true);

        expect(labels()).toEqual(["Unwrap 'if...'"]);
        expect(language.popups.getState().pick?.title).toBe('Choose the statement to unwrap/remove');

        await choose("Unwrap 'if...'");

        expect(shown()).toBe('run();\ndo|Work();\nend();');
    });

    test('offers an else two ways', async () => {
        const { editor, language, labels, choose } = await setup('if (a) {\n    b();\n} else {\n    c|();\n}');

        language.surround.unwrap();

        expect(labels()).toEqual(["Unwrap 'else...'", "Remove 'else...'"]);

        await choose("Remove 'else...'");

        expect(editor.getText()).toBe('if (a) {\n    b();\n}');
    });

    test('lists the innermost construct first', async () => {
        const { language, labels } = await setup('for (const a of b) {\n    try {\n        c|();\n    } finally {\n        d();\n    }\n}');

        language.surround.unwrap();

        expect(labels()).toEqual(["Unwrap 'try...'", "Unwrap 'for...'"]);
    });

    test('offers to remove a catch only when a finally follows', async () => {
        const alone = await setup('try {\n    a();\n} catch (e) {\n    b|();\n}');

        alone.language.surround.unwrap();

        expect(alone.labels()).toEqual([]);

        const followed = await setup('try {\n    a();\n} catch (e) {\n    b|();\n} finally {\n    c();\n}');

        followed.language.surround.unwrap();

        expect(followed.labels()).toEqual(["Remove 'catch...'"]);

        await followed.choose("Remove 'catch...'");

        expect(followed.editor.getText()).toBe('try {\n    a();\n} finally {\n    c();\n}');
    });

    test('unwraps a bare block and a PHP loop', async () => {
        const block = await setup('{\n    a|();\n}');

        block.language.surround.unwrap();
        await block.choose('Unwrap braces');

        expect(block.editor.getText()).toBe('a();');

        const php = await setup('<?php\nforeach ($a as $b) {\n    run|($b);\n}', 'php');

        php.language.surround.unwrap();

        expect(php.labels()).toEqual(["Unwrap 'for...'"]);

        await php.choose("Unwrap 'for...'");

        expect(php.editor.getText()).toBe('<?php\nrun($b);');
    });

    test('removes an enclosing tag and the lines it leaves empty', async () => {
        const { editor, language, labels, choose, shown } = await setup('<div>\n    <ul>\n        <li>a|</li>\n    </ul>\n</div>', 'html');

        language.surround.unwrap();

        expect(labels()).toEqual(['Remove enclosing tag: li', 'Remove enclosing tag: ul', 'Remove enclosing tag: div']);

        await choose('Remove enclosing tag: ul');

        expect(editor.getText()).toBe('<div>\n    <li>a</li>\n</div>');
        expect(shown()).toBe('<div>\n    <li>a|</li>\n</div>');
    });

    test('removes a tag that shares its line with text', async () => {
        const { editor, language, choose } = await setup('<p>one <b>tw|o</b> three</p>', 'html');

        language.surround.unwrap();
        await choose('Remove enclosing tag: b');

        expect(editor.getText()).toBe('<p>one two three</p>');
    });

    test('merges the constructs of the script and of the markup around the caret, the latest first', async () => {
        const { editor, language, labels, choose } = await setup('<template>\n  <p></p>\n</template>\n<script>\nif (a) {\n    b|();\n}\n</script>', 'vue');

        language.surround.unwrap();

        expect(labels()).toEqual(["Unwrap 'if...'", 'Remove enclosing tag: script']);

        await choose("Unwrap 'if...'");

        expect(editor.getText()).toBe('<template>\n  <p></p>\n</template>\n<script>\nb();\n</script>');
    });

    test('narrows the rows as a person types, and shows the construct before and after', async () => {
        const { language, labels, press, timers } = await setup('<div>\n    <p>a|</p>\n</div>', 'html');

        expect(press('Delete', { ctrlKey: true, shiftKey: true })).toBe(true);
        expect(language.pick.isOpen).toBe(true);
        timers.advance(120);
        await settle();

        expect(language.popups.getState().pick?.preview).toEqual({ removed: ['    <p>a</p>'], added: ['    a'], note: null });

        press('d');

        expect(labels()).toEqual(['Remove enclosing tag: div']);
    });

    test('takes its key and does nothing where nothing can be unwrapped', async () => {
        const { editor, language, press } = await setup('run|();');

        expect(press('Delete', { ctrlKey: true, shiftKey: true })).toBe(true);
        expect(language.pick.isOpen).toBe(false);
        expect(editor.getText()).toBe('run();');
    });

    test('does nothing in a read-only editor', async () => {
        const mounted = mountEditor({ text: 'if (a) {\n    b();\n}', language: 'typescript', readOnly: true });
        const project = new ProjectLanguage(new FakeLanguageService());
        const language = new EditorLanguage(project, mounted.editor, 'file:///work/file.ts', 'typescript', new ManualTimers());
        open.push(project, language);
        mounted.editor.setCaret({ line: 1, character: 5 });

        expect(language.surround.unwrap()).toBe(true);
        expect(language.pick.isOpen).toBe(false);
    });
});
