import './test-setup.ts';
import { describe, expect, test } from 'bun:test';
import { FakeEditorEngine } from '@adecore/editor/fake';
import { type Keymap, resolveKeymap } from '@adecore/editor/keymap';
import { EditorLanguage } from './editor-language.ts';
import type { InlineSuggestion, InlineSuggestionSource } from './inline-completion.ts';
import { ProjectLanguage } from './project-language.ts';
import { FakeLanguageService, ManualTimers, settle } from './testing.ts';

const uri = 'file:///work/src/page.ts';
const START = { line: 0, character: 4 };

type From = 'idle' | 'scheduled' | 'asking' | 'showing';
type Action = 'trigger' | 'answer' | 'edit' | 'caret' | 'Escape' | 'accept' | 'acceptWord' | 'cycle' | 'turn off' | 'unregister' | 'dispose';
/* What a source does from inside each of its callbacks, once per action. */
type Reentry = 'nothing' | 'unregisters' | 'triggers';
/* What a test sees of the phase: a ghost, a request that is still out, or neither (idle or an ask queued). */
type Seen = 'showing' | 'asking' | 'quiet';

const FROM: readonly From[] = ['idle', 'scheduled', 'asking', 'showing'];
const ACTIONS: readonly Action[] = ['trigger', 'answer', 'edit', 'caret', 'Escape', 'accept', 'acceptWord', 'cycle', 'turn off', 'unregister', 'dispose'];

/* Where a source that does nothing from its callbacks ends up, so the invariants are not held by a feature that does nothing. */
const EXPECTED: Record<From, Record<Action, Seen>> = {
    idle: {
        trigger: 'asking',
        answer: 'quiet',
        edit: 'quiet',
        caret: 'quiet',
        Escape: 'quiet',
        accept: 'quiet',
        acceptWord: 'quiet',
        cycle: 'quiet',
        'turn off': 'quiet',
        unregister: 'quiet',
        dispose: 'quiet'
    },
    scheduled: {
        trigger: 'asking',
        answer: 'quiet',
        edit: 'quiet',
        caret: 'quiet',
        Escape: 'quiet',
        accept: 'quiet',
        acceptWord: 'quiet',
        cycle: 'quiet',
        'turn off': 'quiet',
        unregister: 'quiet',
        dispose: 'quiet'
    },
    asking: {
        trigger: 'asking',
        answer: 'showing',
        edit: 'quiet',
        caret: 'quiet',
        Escape: 'quiet',
        accept: 'asking',
        acceptWord: 'asking',
        cycle: 'asking',
        'turn off': 'asking',
        unregister: 'quiet',
        dispose: 'quiet'
    },
    showing: {
        trigger: 'asking',
        answer: 'showing',
        edit: 'quiet',
        caret: 'quiet',
        Escape: 'quiet',
        accept: 'quiet',
        acceptWord: 'showing',
        cycle: 'showing',
        'turn off': 'showing',
        unregister: 'quiet',
        dispose: 'quiet'
    }
};

/* An editor with one automatic source of the app whose requests stay out until the test answers them, and which logs every accessory it mounts. */
async function rig(reentry: Reentry) {
    const project = new ProjectLanguage(new FakeLanguageService());
    const editor = new FakeEditorEngine().mount({} as HTMLElement, { text: 'let ', theme: 'light' });
    const timers = new ManualTimers();
    const language = new EditorLanguage(project, editor, uri, 'typescript', timers);
    await language.document.ready;
    await settle();
    editor.moveCaret(START);
    const feature = language.inlineCompletion;

    const state = {
        registered: true,
        enabled: true,
        disposed: false,
        mounts: 0,
        live: [] as number[],
        disposedTwice: 0,
        reentries: 0,
        afterGone: [] as string[],
        signals: [] as AbortSignal[],
        answered: new Set<AbortSignal>(),
        answers: [] as (() => void)[]
    };

    const gone = (): boolean => !state.registered || !state.enabled || state.disposed;

    const reenter = (): void => {
        if (reentry === 'nothing' || state.reentries === 0) {
            return;
        }

        state.reentries--;

        if (reentry === 'unregisters') {
            unregister();
        } else {
            feature.trigger();
        }
    };

    const accessory = (): (() => void) => {
        const id = ++state.mounts;
        state.live.push(id);
        reenter();

        return () => {
            const at = state.live.indexOf(id);

            if (at === -1) {
                state.disposedTwice++;
            } else {
                state.live.splice(at, 1);
            }

            reenter();
        };
    };

    const suggestionsAt = (caret: typeof START): InlineSuggestion[] => [
        { text: 'alpha beta', range: { start: caret, end: caret }, rest: 'alpha beta', words: true, accessory },
        { text: 'gamma', range: { start: caret, end: caret }, rest: 'gamma' }
    ];

    const source: InlineSuggestionSource = {
        get enabled() {
            return state.enabled;
        },
        automatic: true,
        suggest: ({ caret, signal }) => {
            if (gone()) {
                state.afterGone.push('suggest');
            }

            state.signals.push(signal);
            signal.addEventListener('abort', reenter, { once: true });
            reenter();

            return new Promise((resolve) => {
                state.answers.push(() => {
                    state.answered.add(signal);
                    resolve(suggestionsAt(caret));
                });
            });
        },
        accepted: () => {
            if (gone()) {
                state.afterGone.push('accepted');
            }

            reenter();
        }
    };

    const remove = feature.addSource(source, 10);

    function unregister(): void {
        state.registered = false;
        remove();
    }

    const answer = async (): Promise<void> => {
        for (const reply of state.answers.splice(0)) {
            reply();
        }

        await settle();
    };

    const seen = (): Seen => {
        if (feature.current !== null) {
            return 'showing';
        }

        return state.signals.some((signal) => !signal.aborted && !state.answered.has(signal)) ? 'asking' : 'quiet';
    };

    const reach = async (from: From): Promise<void> => {
        if (from === 'scheduled') {
            editor.type('let x');
        } else if (from === 'asking' || from === 'showing') {
            feature.trigger();
            await settle();
        }

        if (from === 'showing') {
            await answer();
        }
    };

    const act = async (action: Action): Promise<void> => {
        state.reentries = 1;

        switch (action) {
            case 'trigger':
                feature.trigger();
                break;
            case 'answer':
                await answer();
                break;
            case 'edit':
                editor.type(`${editor.getText()}y`);
                break;
            case 'caret':
                editor.moveCaret({ line: 0, character: 0 });
                break;
            case 'Escape':
                editor.press({ key: 'Escape' });
                break;
            case 'accept':
                feature.accept();
                break;
            case 'acceptWord':
                feature.acceptWord();
                break;
            case 'cycle':
                feature.cycle(1);
                break;
            case 'turn off':
                state.enabled = false;
                break;
            case 'unregister':
                unregister();
                break;
            case 'dispose':
                state.disposed = true;
                language.dispose();
                break;
        }

        await settle();
        state.reentries = 0;
    };

    const held = (): void => {
        const current = feature.current;
        const ghost = editor.ghost;

        expect(ghost === null).toBe(current === null);
        expect(ghost?.text).toBe(current?.rest);
        expect(state.live).toEqual(current?.accessory === undefined ? [] : [state.mounts]);
        expect(state.disposedTwice).toBe(0);
        expect(state.afterGone).toEqual([]);

        if (!state.registered || state.disposed) {
            expect(state.signals.every((signal) => signal.aborted || state.answered.has(signal))).toBe(true);
        }
    };

    /* Answers what is still out and lets every queued ask run, so a source that is gone shows it was not asked again. */
    const drain = async (): Promise<void> => {
        await answer();
        timers.advance(1000);
        await settle();
        await answer();
    };

    const end = (): void => {
        language.dispose();
        project.dispose();
    };

    return { feature, timers, state, reach, act, held, drain, seen, end };
}

describe('inline completion from every phase', () => {
    for (const reentry of ['nothing', 'unregisters', 'triggers'] as const) {
        describe(`with a source that does ${reentry === 'nothing' ? 'nothing' : `${reentry} itself`} from its callbacks`, () => {
            for (const from of FROM) {
                for (const action of ACTIONS) {
                    test(`${action} while ${from}`, async () => {
                        const setup = await rig(reentry);
                        await setup.reach(from);

                        expect(setup.seen()).toBe(from === 'idle' || from === 'scheduled' ? 'quiet' : from);

                        const queued = setup.timers.size;
                        await setup.act(action);

                        if (reentry === 'nothing') {
                            expect(setup.seen()).toBe(EXPECTED[from][action]);
                        }

                        setup.held();

                        if (from === 'scheduled' && action === 'unregister') {
                            expect(setup.timers.size).toBe(queued - 1);
                        }

                        await setup.drain();
                        setup.held();
                        setup.end();
                    });
                }
            }
        });
    }
});

describe('inline completion with the language servers turned off', () => {
    test('aborts their request and drops the ask that typing queued for them', async () => {
        let signal: AbortSignal | undefined;
        const service = new FakeLanguageService();
        service.respond('textDocument/inlineCompletion', (call) => {
            signal = call.options.signal;

            return new Promise(() => undefined);
        });
        const project = new ProjectLanguage(service);
        const editor = new FakeEditorEngine().mount({} as HTMLElement, { text: '', theme: 'light' });
        const timers = new ManualTimers();
        const language = new EditorLanguage(project, editor, uri, 'typescript', timers);
        await language.document.ready;
        await settle();
        language.inlineCompletion.configure({ enabled: true });
        language.inlineCompletion.trigger();
        await settle();
        language.inlineCompletion.configure({ enabled: false });

        expect(signal?.aborted).toBe(true);

        editor.type('a');
        language.inlineCompletion.configure({ enabled: true });
        editor.type('ab');
        const queued = timers.size;
        language.inlineCompletion.configure({ enabled: false });

        expect(timers.size).toBe(queued - 1);

        language.dispose();
        project.dispose();
    });
});

describe('the keys of inline completion', () => {
    /* An editor whose host's keymap the test rebinds, with one manual source that answers the given suggestions at once. */
    async function keyed(texts: readonly string[]) {
        let keymap: Keymap = resolveKeymap({ suggestInline: { mac: 'Alt+F9', other: 'Alt+F9' } });
        const project = new ProjectLanguage(new FakeLanguageService(), {
            get keymap() {
                return keymap;
            }
        });
        const editor = new FakeEditorEngine().mount({} as HTMLElement, { text: 'let ', theme: 'light' });
        const language = new EditorLanguage(project, editor, uri, 'typescript', new ManualTimers());
        await language.document.ready;
        await settle();
        editor.moveCaret(START);

        language.inlineCompletion.addSource({
            enabled: true,
            automatic: false,
            suggest: async ({ caret }) => texts.map((text) => ({ text, range: { start: caret, end: caret }, rest: text }))
        });

        const rebind = (next: Keymap): void => {
            keymap = next;
        };

        const end = (): void => {
            language.dispose();
            project.dispose();
        };

        return { editor, language, rebind, end };
    }

    test('a key rebound while the editor is open asks for a suggestion, and the old key no longer does', async () => {
        const { editor, language, rebind, end } = await keyed(['alpha']);

        rebind(resolveKeymap({ suggestInline: { mac: 'Alt+F10', other: 'Alt+F10' } }));

        expect(editor.press({ key: 'F9', code: 'F9', altKey: true })).toBe(false);
        expect(editor.press({ key: 'F10', code: 'F10', altKey: true })).toBe(true);

        await settle();

        expect(language.inlineCompletion.current?.rest).toBe('alpha');

        end();
    });

    test('with one suggestion Alt+[ and Alt+] go on to the editor, and with two they cycle', async () => {
        const one = await keyed(['alpha']);
        one.editor.press({ key: 'F9', code: 'F9', altKey: true });
        await settle();

        expect(one.language.inlineCompletion.current?.rest).toBe('alpha');
        expect(one.editor.press({ key: '“', code: 'BracketLeft', altKey: true })).toBe(false);
        expect(one.editor.press({ key: '‘', code: 'BracketRight', altKey: true })).toBe(false);

        one.end();

        const two = await keyed(['alpha', 'beta']);
        two.editor.press({ key: 'F9', code: 'F9', altKey: true });
        await settle();

        expect(two.editor.press({ key: '‘', code: 'BracketRight', altKey: true })).toBe(true);
        expect(two.language.inlineCompletion.current?.rest).toBe('beta');

        two.end();
    });
});
