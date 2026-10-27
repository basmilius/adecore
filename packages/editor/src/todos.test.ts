import { describe, expect, test } from 'bun:test';
import { mountEditor } from './testing.ts';

function todoSpans(host: HTMLElement): string[] {
    return [...host.querySelectorAll<HTMLElement>('.se-line span')]
        .filter((span) => span.style.color === 'var(--editor-todo)')
        .map((span) => span.textContent ?? '');
}

describe('TODO comments', () => {
    test('are drawn in their own color from the word to the end of the comment, and ticked in the scroll track', () => {
        // Apart, since ticks of one kind that touch are drawn as one.
        const text = `const todo = "TODO";\n// TODO: rename${'\n'.repeat(10)}/* fixme now */ call();`;
        const { editor, page } = mountEditor({ text, language: 'typescript' });

        expect(todoSpans(page.host)).toEqual(['TODO: rename', 'fixme now ']);

        const ticks = [...page.host.querySelectorAll('.se-tick-todo')];

        expect(ticks.map((tick) => tick.getAttribute('data-title'))).toEqual(['TODO: rename', 'fixme now ']);
        expect(ticks[0]!.getAttribute('data-offset')).toBe(String(editor.offsetAt({ line: 1, character: 3 })));
    });

    test('follow the words the host sets, and an empty list draws none', () => {
        const { editor, page } = mountEditor({ text: '// TODO one\n// HACK two', language: 'typescript', todoWords: ['HACK'] });

        expect(todoSpans(page.host)).toEqual(['HACK two']);

        editor.setTodoWords!([]);

        expect(todoSpans(page.host)).toEqual([]);
        expect(page.host.querySelectorAll('.se-tick-todo')).toHaveLength(0);
    });
});
