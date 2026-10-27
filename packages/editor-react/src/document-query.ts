import type { EditorLanguage } from './editor-language.ts';
import type { Timers } from './timers.ts';

/*
 * Asks the servers for something of the whole document: once it is open, a moment after the last edit, and
 * whenever what the servers offer changes. An edit clears the answer at once, since its ranges point into a
 * text that is gone; an answer for an older text is dropped.
 */
export class DocumentQuery<Value> {
    private readonly language: EditorLanguage;
    private readonly timers: Timers;
    private readonly delay: number;
    private readonly ask: (signal: AbortSignal) => Promise<Value | null>;
    private readonly apply: (value: Value | null) => void;
    private timer: unknown = null;
    private controller: AbortController | null = null;
    private generation = 0;

    constructor(
        language: EditorLanguage,
        timers: Timers,
        delay: number,
        ask: (signal: AbortSignal) => Promise<Value | null>,
        apply: (value: Value | null) => void
    ) {
        this.language = language;
        this.timers = timers;
        this.delay = delay;
        this.ask = ask;
        this.apply = apply;
        const offs = [
            language.onProvidersChanged(() => this.run()),
            language.editor.onTextChange(() => {
                this.cancel();
                this.apply(null);
                this.timer = this.timers.set(() => this.run(), this.delay);
            })
        ];
        language.onDispose(() => {
            this.cancel();
            for (const off of offs) {
                off();
            }
        });
    }

    /* Asks again now, as a refresh of the host does. */
    run(): void {
        this.cancel();
        const generation = this.generation;
        const controller = new AbortController();
        this.controller = controller;
        this.ask(controller.signal).then(
            (value) => {
                if (generation === this.generation && !this.language.isDisposed) {
                    this.apply(value);
                }
            },
            // A server that fails or refuses answers nothing; the next edit asks again.
            () => undefined
        );
    }

    private cancel(): void {
        this.generation++;
        this.timers.clear(this.timer);
        this.timer = null;
        this.controller?.abort();
        this.controller = null;
    }
}
