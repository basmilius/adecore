import './test-setup.ts';
import { afterEach, describe, expect, test } from 'bun:test';
import { FakeEditorEngine } from '@adecore/editor/fake';
import { EditorLanguage } from './editor-language.ts';
import type { PickSpec } from './pick.ts';
import type { PickPreview } from './popups.ts';
import { ProjectLanguage } from './project-language.ts';
import { settle } from './test-support.ts';
import { FakeLanguageService, ManualTimers } from './testing.ts';

const uri = 'file:///work/app/src/a.ts';
const anchor = { line: 1, character: 2 };
const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];

const open: Array<{ dispose(): void }> = [];

afterEach(() => {
    for (const owner of open.splice(0).reverse()) {
        owner.dispose();
    }
});

async function setup() {
    const project = new ProjectLanguage(new FakeLanguageService());
    const editor = new FakeEditorEngine().mount({} as HTMLElement, { text: 'one\ntwo\nthree', theme: 'light' });
    const timers = new ManualTimers();
    const language = new EditorLanguage(project, editor, uri, 'typescript', timers);
    open.push(project, language);
    await language.document.ready;
    const accepted: string[] = [];

    const openPick = (spec: Partial<PickSpec> = {}) =>
        language.pick.open({
            anchor,
            groups: [
                { title: 'First', rows: IDS.slice(0, 2).map((id) => ({ id, label: id.toUpperCase(), detail: '' })) },
                { title: 'Rest', rows: IDS.slice(2).map((id) => ({ id, label: id.toUpperCase(), detail: '' })) }
            ],
            accept: (id) => accepted.push(id),
            ...spec
        });

    const active = () => language.popups.getState().pick?.active ?? null;

    return { editor, language, timers, accepted, openPick, active };
}

describe('the pick list', () => {
    test('opens under its anchor on the first row of all its groups', async () => {
        const { language, openPick } = await setup();
        openPick({ title: 'Choose' });

        expect(language.pick.isOpen).toBe(true);

        const view = language.popups.getState().pick!;

        expect(view.anchor).toEqual(anchor);
        expect(view.title).toBe('Choose');
        expect(view.active).toBe('a');
        expect(view.preview).toBeNull();
        expect(view.groups.map((group) => group.title)).toEqual(['First', 'Rest']);
    });

    test('opens on the row it is told to, and on the first when that row is not in the list', async () => {
        const { openPick, active } = await setup();
        openPick({ active: 'd' });

        expect(active()).toBe('d');

        openPick({ active: 'z' });

        expect(active()).toBe('a');
    });

    test('opens nothing for a list without rows', async () => {
        const { language } = await setup();
        language.pick.open({ anchor, groups: [{ title: null, rows: [] }], accept: () => undefined });

        expect(language.pick.isOpen).toBe(false);
        expect(language.popups.getState().pick).toBeNull();
    });

    test('moves through the rows across groups with the arrow keys and stops at either end', async () => {
        const { editor, openPick, active } = await setup();
        openPick();

        expect(editor.press({ key: 'ArrowUp' })).toBe(true);
        expect(active()).toBe('a');

        editor.press({ key: 'ArrowDown' });
        editor.press({ key: 'ArrowDown' });

        expect(active()).toBe('c');

        editor.press({ key: 'ArrowUp' });

        expect(active()).toBe('b');
    });

    test('pages by eight rows and jumps to the first and last with Home and End', async () => {
        const { editor, openPick, active } = await setup();
        openPick();
        editor.press({ key: 'PageDown' });

        expect(active()).toBe('i');

        editor.press({ key: 'PageDown' });

        expect(active()).toBe('l');

        editor.press({ key: 'PageUp' });

        expect(active()).toBe('d');

        editor.press({ key: 'Home' });

        expect(active()).toBe('a');

        editor.press({ key: 'End' });

        expect(active()).toBe('l');
    });

    test('takes the active row with Enter after it closes', async () => {
        const { editor, language, accepted, openPick } = await setup();
        let shownWhenAccepted: unknown;

        openPick({
            accept: (id) => {
                shownWhenAccepted = language.popups.getState().pick;
                accepted.push(id);
            }
        });

        editor.press({ key: 'ArrowDown' });

        expect(editor.press({ key: 'Enter' })).toBe(true);
        expect(accepted).toEqual(['b']);
        expect(shownWhenAccepted).toBeNull();
        expect(language.pick.isOpen).toBe(false);
    });

    test('takes the active row with Tab, unless the list hands Tab back to its workflow', async () => {
        const { editor, accepted, openPick, language } = await setup();
        openPick();
        editor.press({ key: 'Tab' });

        expect(accepted).toEqual(['a']);

        const tabs: boolean[] = [];
        openPick({ onTab: (backwards) => tabs.push(backwards) });

        expect(editor.press({ key: 'Tab', shiftKey: true })).toBe(true);
        expect(tabs).toEqual([true]);
        expect(accepted).toEqual(['a']);
        expect(language.pick.isOpen).toBe(false);
    });

    test('closes with Escape without taking a row', async () => {
        const { editor, language, accepted, openPick } = await setup();
        openPick();

        expect(editor.press({ key: 'Escape' })).toBe(true);
        expect(language.popups.getState().pick).toBeNull();
        expect(accepted).toEqual([]);
    });

    test('leaves keys with a modifier, other keys, and every key while closed to the editor', async () => {
        const { editor, openPick, active } = await setup();

        expect(editor.press({ key: 'ArrowDown' })).toBe(false);

        openPick();

        expect(editor.press({ key: 'ArrowDown', metaKey: true })).toBe(false);
        expect(editor.press({ key: 'ArrowDown', ctrlKey: true })).toBe(false);
        expect(editor.press({ key: 'ArrowDown', altKey: true })).toBe(false);
        expect(editor.press({ key: 'x' })).toBe(false);
        expect(active()).toBe('a');
    });

    test('closes on an edit, a move of the caret and the focus leaving the editor', async () => {
        const { editor, language, openPick } = await setup();
        openPick();
        editor.type('one\ntwo\nthree!');

        expect(language.pick.isOpen).toBe(false);

        openPick();
        editor.moveCaret({ line: 2, character: 1 });

        expect(language.pick.isOpen).toBe(false);

        openPick();
        editor.blur();

        expect(language.pick.isOpen).toBe(false);
        expect(language.popups.getState().pick).toBeNull();
    });

    test('ignores a choice of a row it does not have', async () => {
        const { language, accepted, openPick } = await setup();
        openPick();
        language.pick.choose('z');

        expect(accepted).toEqual([]);
        expect(language.pick.isOpen).toBe(true);
    });

    test('closes when the editor lets go of the document', async () => {
        const { language, openPick } = await setup();
        openPick();
        language.dispose();

        expect(language.popups.getState().pick).toBeNull();
    });
});

describe('a row that is attempted first', () => {
    test('keeps the list open with the reason a row cannot be taken, and takes one that can', async () => {
        const { language, accepted, openPick, active } = await setup();
        openPick({ attempt: async (id) => (id === 'a' ? 'Name is taken' : null) });
        language.pick.choose('a');
        await settle();

        expect(accepted).toEqual([]);
        expect(language.popups.getState().pick?.preview).toEqual({ removed: [], added: [], note: null, refusal: 'Name is taken' });

        language.pick.move(1);

        expect(active()).toBe('b');
        expect(language.popups.getState().pick?.preview).toBeNull();

        language.pick.choose('b');
        await settle();

        expect(accepted).toEqual(['b']);
        expect(language.pick.isOpen).toBe(false);
    });

    test('takes a row whose attempt fails, and ignores another choice while one is attempted', async () => {
        const { language, accepted, openPick } = await setup();
        let attempts = 0;

        openPick({
            attempt: async () => {
                attempts++;

                throw new Error('No answer');
            }
        });

        language.pick.choose('a');
        language.pick.choose('b');
        await settle();

        expect(attempts).toBe(1);
        expect(accepted).toEqual(['a']);
    });

    test('drops the outcome of an attempt for a list that has closed', async () => {
        const { language, accepted, openPick } = await setup();
        openPick({ attempt: async () => null });
        language.pick.choose('a');
        language.pick.close();
        await settle();

        expect(accepted).toEqual([]);
    });
});

describe('the preview of the active row', () => {
    const change: PickPreview = { removed: ['old'], added: ['new'], note: null };

    test('is asked for a moment after a row becomes active and shown while it stays active', async () => {
        const { language, timers, openPick } = await setup();
        const asked: string[] = [];

        openPick({
            preview: async (id) => {
                asked.push(id);

                return change;
            }
        });

        timers.advance(100);

        expect(asked).toEqual([]);

        timers.advance(20);
        await settle();

        expect(asked).toEqual(['a']);
        expect(language.popups.getState().pick?.preview).toEqual(change);
    });

    test('drops an answer for a row that is no longer active', async () => {
        const { language, timers, openPick, active } = await setup();
        const signals: AbortSignal[] = [];

        let answer = (_preview: PickPreview): void => undefined;

        openPick({
            preview: (_id, signal) => {
                signals.push(signal);

                return new Promise<PickPreview>((resolve) => {
                    answer = resolve;
                });
            }
        });

        timers.advance(120);
        language.pick.move(1);

        expect(signals[0]!.aborted).toBe(true);

        answer(change);
        await settle();

        expect(active()).toBe('b');
        expect(language.popups.getState().pick?.preview).toBeNull();
    });

    test('is not asked for when the list closes before the moment passes', async () => {
        const { language, timers, openPick } = await setup();
        const asked: string[] = [];

        openPick({
            preview: async (id) => {
                asked.push(id);

                return change;
            }
        });

        language.pick.close();
        timers.advance(200);
        await settle();

        expect(asked).toEqual([]);
    });
});

describe('a pick list that filters', () => {
    const rows = [
        { id: 'a', label: 'Alpha', detail: '', search: 'alpha first\nsecond line' },
        { id: 'b', label: 'Beta', detail: '' },
        { id: 'c', label: 'Gamma', detail: '' }
    ];

    async function filtering(spec: Partial<PickSpec> = {}) {
        const context = await setup();

        context.openPick({ groups: [{ title: null, rows }], filter: true, ...spec });

        const view = () => context.language.popups.getState().pick!;

        return { ...context, view };
    }

    test('narrows the rows to those that contain what is typed, whatever the case, and keeps the list open', async () => {
        const { editor, language, view, active } = await filtering();

        expect(view().query).toBe('');
        expect(editor.press({ key: 'E' })).toBe(true);
        editor.press({ key: 'T' });

        expect(view().query).toBe('ET');
        expect(view().groups[0]!.rows.map((row) => row.id)).toEqual(['b']);
        expect(active()).toBe('b');
        expect(language.pick.isOpen).toBe(true);
    });

    test('matches the search text of a row instead of its label', async () => {
        const { editor, view } = await filtering();

        for (const key of 'second') {
            editor.press({ key });
        }

        expect(view().groups[0]!.rows.map((row) => row.id)).toEqual(['a']);
    });

    test('drops a group without rows and puts the first row left active', async () => {
        const { editor, view, active } = await filtering({
            groups: [
                { title: 'One', rows: rows.slice(0, 1) },
                { title: 'Two', rows: rows.slice(1) }
            ]
        });

        editor.press({ key: 'g' });

        expect(view().groups.map((group) => group.title)).toEqual(['Two']);
        expect(active()).toBe('c');
    });

    test('Backspace takes the last character off the query and brings the rows back', async () => {
        const { editor, view } = await filtering();

        editor.press({ key: 'b' });
        editor.press({ key: 'x' });

        expect(view().groups).toEqual([]);

        editor.press({ key: 'Backspace' });

        expect(view().query).toBe('b');
        expect(view().groups[0]!.rows.map((row) => row.id)).toEqual(['b']);
        expect(editor.press({ key: 'Backspace' })).toBe(true);
        expect(view().groups[0]!.rows).toHaveLength(3);
    });

    test('takes no row with Enter while nothing matches', async () => {
        const { editor, accepted, language } = await filtering();

        editor.press({ key: 'z' });
        editor.press({ key: 'Enter' });

        expect(accepted).toEqual([]);
        expect(language.pick.isOpen).toBe(true);
    });

    test('hands a list that does not filter its keys to the editor', async () => {
        const { editor, openPick } = await setup();
        openPick();

        expect(editor.press({ key: 'x' })).toBe(false);
        expect(editor.press({ key: 'Backspace' })).toBe(false);
    });

    test('leaves a key with Mod to the editor', async () => {
        const { editor } = await filtering();

        expect(editor.press({ key: 'v', metaKey: true })).toBe(false);
    });
});

describe('a pick list of several choices', () => {
    async function several(spec: Partial<PickSpec> = {}) {
        const context = await setup();
        const many: string[][] = [];

        context.openPick({ multiple: true, acceptMany: (ids) => many.push([...ids]), ...spec });

        return { ...context, many, view: () => context.language.popups.getState().pick! };
    }

    test('grows a run of rows from the active one with Shift and the arrows, and shrinks it again', async () => {
        const { editor, view } = await several();

        editor.press({ key: 'ArrowDown', shiftKey: true });
        editor.press({ key: 'ArrowDown', shiftKey: true });

        expect(view().chosen).toEqual(['a', 'b', 'c']);
        expect(view().active).toBe('c');

        editor.press({ key: 'ArrowUp', shiftKey: true });

        expect(view().chosen).toEqual(['a', 'b']);

        editor.press({ key: 'ArrowUp', shiftKey: true });

        expect(view().chosen).toEqual([]);
        expect(view().active).toBe('a');
    });

    test('a plain arrow forgets the choice', async () => {
        const { editor, view } = await several();

        editor.press({ key: 'ArrowDown', shiftKey: true });
        editor.press({ key: 'ArrowDown' });

        expect(view().chosen).toEqual([]);
    });

    test('Enter hands over the chosen rows in list order, or the active row when none is chosen', async () => {
        const { editor, many, accepted, language } = await several();

        editor.press({ key: 'ArrowDown', shiftKey: true });
        editor.press({ key: 'Enter' });

        expect(many).toEqual([['a', 'b']]);
        expect(accepted).toEqual([]);
        expect(language.pick.isOpen).toBe(false);

        language.pick.open({
            anchor,
            groups: [{ title: null, rows: [{ id: 'x', label: 'X', detail: '' }] }],
            accept: () => undefined,
            acceptMany: (ids) => many.push([...ids])
        });
        editor.press({ key: 'Enter' });

        expect(many.at(-1)).toEqual(['x']);
    });

    test('Enter takes the active row with accept when the list has no acceptMany', async () => {
        const { editor, accepted, openPick } = await setup();
        openPick({ multiple: true });

        editor.press({ key: 'ArrowDown', shiftKey: true });
        editor.press({ key: 'Enter' });

        expect(accepted).toEqual(['b']);
    });

    test('Mod and a press add and take away a row, Shift and a press choose the run up to it', async () => {
        const { language, view } = await several();

        language.pick.choose('c', { toggle: true });

        expect(view().chosen).toEqual(['a', 'c']);

        language.pick.choose('a', { toggle: true });

        expect(view().chosen).toEqual(['c']);

        language.pick.choose('e', { range: true });

        expect(view().chosen).toEqual(['a', 'b', 'c', 'd', 'e']);
        expect(view().active).toBe('e');

        language.pick.choose('c', { range: true });

        expect(view().chosen).toEqual(['a', 'b', 'c']);
    });

    test('a press without a modifier takes the row alone', async () => {
        const { language, accepted, many } = await several();

        language.pick.choose('b');

        expect(accepted).toEqual(['b']);
        expect(many).toEqual([]);
    });

    test('ignores Shift and the arrows in a list of one choice', async () => {
        const { editor, openPick, language } = await setup();
        openPick();

        editor.press({ key: 'ArrowDown', shiftKey: true });

        expect(language.popups.getState().pick!.chosen).toEqual([]);
        expect(language.popups.getState().pick!.active).toBe('b');
    });
});

describe('a pick list whose rows can be removed', () => {
    async function removable() {
        const context = await setup();
        const removed: string[][] = [];
        let left = ['a', 'b', 'c', 'd'];

        const group = () => [{ title: null, rows: left.map((id) => ({ id, label: id.toUpperCase(), detail: '' })) }];

        context.openPick({
            groups: group(),
            multiple: true,
            remove: (ids) => {
                removed.push([...ids]);
                left = left.filter((id) => !ids.includes(id));

                return group();
            }
        });

        return { ...context, removed, view: () => context.language.popups.getState().pick! };
    }

    test('Delete takes out the active row and lands on the one that took its place', async () => {
        const { editor, removed, view } = await removable();

        editor.press({ key: 'ArrowDown' });

        expect(editor.press({ key: 'Delete' })).toBe(true);
        expect(removed).toEqual([['b']]);
        expect(view().groups[0]!.rows.map((row) => row.id)).toEqual(['a', 'c', 'd']);
        expect(view().active).toBe('c');
    });

    test('Delete takes out the chosen rows, and the last row lands on the one before', async () => {
        const { editor, removed, view } = await removable();

        editor.press({ key: 'End' });
        editor.press({ key: 'ArrowUp', shiftKey: true });
        editor.press({ key: 'Delete' });

        expect(removed).toEqual([['c', 'd']]);
        expect(view().active).toBe('b');
    });

    test('Backspace takes out a row while there is no query', async () => {
        const { editor, removed } = await removable();

        expect(editor.press({ key: 'Backspace' })).toBe(true);
        expect(removed).toEqual([['a']]);
    });

    test('closes when the last row is gone', async () => {
        const { editor, language } = await removable();

        for (let i = 0; i < 4; i++) {
            editor.press({ key: 'Delete' });
        }

        expect(language.pick.isOpen).toBe(false);
    });

    test('leaves Delete to the editor in a list that cannot remove', async () => {
        const { editor, openPick } = await setup();
        openPick();

        expect(editor.press({ key: 'Delete' })).toBe(false);
    });
});
