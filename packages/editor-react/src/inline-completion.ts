import type { EditorPosition, EditorTextChange } from '@adecore/editor';
import type { InlineCompletionItem, InlineCompletionResult, Range } from '@adecore/lsp';
import { KEY_PRIORITY } from './key-priority.ts';
import type { LanguageContext } from './language-context.ts';
import { comparePositions, endOfInsertion } from './positions.ts';
import { isShortcut } from './shortcut-keys.ts';
import { parseSnippet } from './snippet.ts';
import { realTimers, type Timers } from './timers.ts';

const METHOD = 'textDocument/inlineCompletion';
const DELAY_MS = 300;

/* A suggestion as the text it inserts at the caret: what follows what was already typed of it. */
export interface InlineSuggestion {
    /* What replaces `range` on acceptance. */
    readonly text: string;
    readonly range: Range;
    /* What the ghost shows after the caret. */
    readonly rest: string;
    /* The server's item, for the command that runs once the suggestion is taken. */
    readonly item?: InlineCompletionItem;
    /* Fills the element after the first line of the ghost, such as the keys that take it. What it returns runs once, when that element is taken away. */
    readonly accessory?: (container: HTMLElement) => (() => void) | void;
    /* Whether the suggestion may be taken a word at a time. It must be an insertion at the caret. */
    readonly words?: boolean;
}

export interface InlineSuggestionRequest {
    readonly caret: EditorPosition;
    /* 1 for a person asking, 2 for typing that stopped. */
    readonly triggerKind: 1 | 2;
    /* Aborted when the text changes, the caret moves away, or the suggestions are put away, so an answer after that shows nothing. */
    readonly signal: AbortSignal;
}

/* Where suggestions come from. The feature draws one of them at a time and owns the keys that take it. */
export interface InlineSuggestionSource {
    /* Whether the source is asked now; read every time, so a setting of the app can turn it off. */
    readonly enabled: boolean;
    /* Whether it is asked when typing stops, and not only when a person asks. */
    readonly automatic: boolean;
    suggest(request: InlineSuggestionRequest): Promise<readonly InlineSuggestion[]>;
    accepted?(suggestion: InlineSuggestion): void;
}

export function itemsOf(result: InlineCompletionResult): InlineCompletionItem[] {
    if (result === null) {
        return [];
    }
    return Array.isArray(result) ? result : result.items;
}

/* Whether the suggestion still continues the text at the caret: the caret is in its range and what lies between the range's start and it is how the suggestion begins. */
function continuesAt(suggestion: Pick<InlineSuggestion, 'text' | 'range'>, caret: EditorPosition, textOf: (range: Range) => string): boolean {
    const { range } = suggestion;
    if (comparePositions(range.start, caret) > 0 || comparePositions(range.end, caret) < 0) {
        return false;
    }
    return suggestion.text.startsWith(textOf({ start: range.start, end: caret }));
}

/*
 * A server's item as a suggestion at the caret, or null when it does not continue what the line holds: the text the
 * item replaces up to the caret must start its insert text, so the rest can stand after the caret.
 */
export function suggestionOf(item: InlineCompletionItem, caret: EditorPosition, textOf: (range: Range) => string): InlineSuggestion | null {
    const text = typeof item.insertText === 'string' ? item.insertText : parseSnippet(item.insertText.value).text;
    const range = item.range ?? { start: caret, end: caret };
    if (!continuesAt({ text, range }, caret, textOf)) {
        return null;
    }
    const rest = text.slice(textOf({ start: range.start, end: caret }).length);
    return rest === '' ? null : { item, text, range, rest };
}

/* The first word of a suggestion with the whitespace before it, which is what taking a word takes. */
export function firstWord(text: string): string {
    const match = /^\s*(?:[\p{L}\p{N}_$]+|[^\p{L}\p{N}_$\s]+)/u.exec(text);
    return match === null ? text : match[0];
}

interface Registered {
    readonly source: InlineSuggestionSource;
    readonly priority: number;
}

interface Asking {
    readonly kind: 'asking';
    readonly source: InlineSuggestionSource;
    readonly controller: AbortController;
    readonly caret: EditorPosition;
    readonly manual: boolean;
}

/*
 * Where the feature stands. Every phase but `idle` belongs to one source, so no field can still point at a source
 * that is gone. A phase is never changed in place: a new object for every step, so a call that compares
 * `this.phase` with the one it entered knows whether foreign code moved the feature on in between.
 */
type Phase =
    | { readonly kind: 'idle' }
    | { readonly kind: 'scheduled'; readonly source: InlineSuggestionSource; readonly timer: unknown }
    | Asking
    | {
          readonly kind: 'showing';
          readonly source: InlineSuggestionSource;
          readonly suggestions: readonly InlineSuggestion[];
          readonly index: number;
          readonly manual: boolean;
      };

/* Lets go of what a phase holds outside the feature. Aborting runs the source's listeners, which may call back in. */
function release(phase: Phase, timers: Timers): void {
    if (phase.kind === 'scheduled') {
        timers.clear(phase.timer);
    } else if (phase.kind === 'asking') {
        phase.controller.abort();
    }
}

/* The language servers as a source: asked after typing stops, once the host turned it on. */
class ServerSuggestions implements InlineSuggestionSource {
    readonly automatic = true;
    enabledByHost = false;
    private readonly language: LanguageContext;

    constructor(language: LanguageContext) {
        this.language = language;
    }

    get enabled(): boolean {
        return this.enabledByHost && this.supported;
    }

    get supported(): boolean {
        const { service } = this.language;
        return service.inlineCompletions !== undefined && service.supports(METHOD, this.language.uri);
    }

    async suggest(request: InlineSuggestionRequest): Promise<readonly InlineSuggestion[]> {
        const { editor, service, uri } = this.language;
        try {
            const result = await service.inlineCompletions!(uri, request.caret, { triggerKind: request.triggerKind }, { signal: request.signal });
            return itemsOf(result).flatMap((item) => suggestionOf(item, request.caret, (range) => editor.textInRange(range)) ?? []);
        } catch {
            // A refusal or a failing server is no suggestion; the next pause asks again.
            return [];
        }
    }

    accepted(suggestion: InlineSuggestion): void {
        const { service, uri } = this.language;
        const command = suggestion.item?.command;
        if (command !== undefined && service.supports('workspace/executeCommand', uri)) {
            void service.executeCommand(uri, command).catch(() => undefined);
        }
    }
}

/*
 * The one owner of the editor's ghost text. Sources give it suggestions: the language servers' (off unless the host
 * turns it on with `configure`) and any an app adds with `addSource`. It draws one at a time, takes it with Tab,
 * steps through the others with Alt+] and Alt+[ and puts it away with Escape or any edit or move away from it.
 *
 * A key of the host's (`suggestInline`) asks the enabled source of the highest priority at once; typing that stops asks
 * the automatic source of the highest priority. Tab takes the suggestion before a suggestion list when a person asked
 * for it, and after the list when it came by itself.
 */
export class InlineCompletionFeature {
    private readonly language: LanguageContext;
    private readonly timers: Timers;
    private readonly servers: ServerSuggestions;
    private readonly sources: Registered[] = [];
    private phase: Phase = { kind: 'idle' };
    private accepting = false;

    constructor(language: LanguageContext, timers: Timers = realTimers) {
        this.language = language;
        this.timers = timers;
        this.servers = new ServerSuggestions(language);
        this.addSource(this.servers, -1);
        const { editor } = language;
        const offs = [
            language.onKey((event) => this.key(event), KEY_PRIORITY.inlineCompletion),
            language.onKey((event) => this.tab(event), KEY_PRIORITY.suggestionAccept),
            editor.onTextChange((change) => this.edited(change)),
            editor.onCaret(() => this.moved())
        ];
        language.onDispose(() => {
            // No source is asked again, also not by one that calls back in while it is let go of.
            this.sources.splice(0);
            this.hide();
            for (const off of offs) {
                off();
            }
        });
    }

    get supported(): boolean {
        return this.servers.supported;
    }

    get isEnabled(): boolean {
        return this.servers.enabledByHost;
    }

    get current(): InlineSuggestion | null {
        const { phase } = this;
        return phase.kind === 'showing' ? (phase.suggestions[phase.index] ?? null) : null;
    }

    holds(source: InlineSuggestionSource): boolean {
        return this.phase.kind === 'showing' && this.phase.source === source;
    }

    /* Adds a source; of two the one with the higher priority is asked first, and the language servers' has -1. */
    addSource(source: InlineSuggestionSource, priority = 0): () => void {
        const entry = { source, priority };
        const index = this.sources.findIndex((other) => other.priority < priority);
        this.sources.splice(index === -1 ? this.sources.length : index, 0, entry);

        return () => {
            const at = this.sources.indexOf(entry);

            if (at !== -1) {
                this.sources.splice(at, 1);
            }
            if (this.uses(source)) {
                this.hide();
            }
        };
    }

    /* Turns the language servers' suggestions on or off; they are off until the host asks. */
    configure(settings: { readonly enabled?: boolean }): void {
        this.servers.enabledByHost = settings.enabled === true;
        if (!this.servers.enabledByHost && this.uses(this.servers)) {
            this.hide();
        }
    }

    /* Whether the source has a suggestion drawn, a request out or an ask queued. */
    private uses(source: InlineSuggestionSource): boolean {
        return this.phase.kind !== 'idle' && this.phase.source === source;
    }

    /* Whether the source is registered and enabled. An app's setting can turn a source off without telling this feature, so it is read at every step. */
    private asks(source: InlineSuggestionSource): boolean {
        return source.enabled && this.sources.some((entry) => entry.source === source);
    }

    /* Asks the enabled source of the highest priority for suggestions at the caret now, as a person asking for one does; false when none is enabled. */
    trigger(): boolean {
        const source = this.sources.find((entry) => entry.source.enabled)?.source;
        if (source === undefined) {
            return false;
        }
        void this.ask(source, 1);
        return true;
    }

    /* Asks one source now, for an app whose own command asks for its suggestion; settles once the answer is drawn or dropped. */
    triggerSource(source: InlineSuggestionSource): Promise<void> {
        return this.ask(source, 1);
    }

    /* Takes the drawn suggestion into the text; false when there is none. */
    accept(): boolean {
        const { phase } = this;
        const suggestion = this.current;
        if (phase.kind !== 'showing' || suggestion === null) {
            return false;
        }
        this.insert(suggestion.range, suggestion.text, endOfInsertion(suggestion.range.start, suggestion.text));
        if (this.phase === phase) {
            this.enter({ kind: 'idle' });
        }
        // Last: the disposer of the accessory ran in between and may have taken the source away.
        if (this.asks(phase.source)) {
            phase.source.accepted?.(suggestion);
        }
        return true;
    }

    /* Takes the first word of a suggestion that allows it; the rest stays drawn after it. */
    acceptWord(): boolean {
        const { phase } = this;
        const suggestion = this.current;
        if (phase.kind !== 'showing' || suggestion === null || suggestion.words !== true) {
            return false;
        }
        const caret = this.language.editor.getCaret();
        const word = firstWord(suggestion.rest);
        const next = endOfInsertion(caret, word);
        this.insert({ start: caret, end: caret }, word, next);
        if (this.phase !== phase) {
            return true;
        }
        const rest = suggestion.rest.slice(word.length);
        this.enter(
            rest.trim() === ''
                ? { kind: 'idle' }
                : { ...phase, suggestions: [{ ...suggestion, range: { start: next, end: next }, text: rest, rest }], index: 0 }
        );
        return true;
    }

    cycle(step: 1 | -1): void {
        const { phase } = this;
        if (phase.kind !== 'showing' || phase.suggestions.length < 2) {
            return;
        }
        const count = phase.suggestions.length;
        this.enter({ ...phase, index: (phase.index + step + count) % count });
    }

    /* Puts the suggestions away and ends a request that is still out. */
    hide(): void {
        this.enter({ kind: 'idle' });
    }

    /*
     * The one way the phase changes: state first, then the previous phase let go of, then the ghost drawn from
     * `this.phase` alone. Letting go runs the source's abort listeners, so drawing waits until they are done and
     * is skipped when they entered a phase of their own, which drew itself.
     */
    private enter(next: Phase): void {
        const previous = this.phase;
        this.phase = next;
        release(previous, this.timers);
        if (this.phase !== next) {
            return;
        }
        if (previous.kind === 'showing' || next.kind === 'showing') {
            this.draw();
        }
    }

    /* An edit and caret of the feature's own, which neither puts the suggestion away nor asks again. */
    private insert(range: Range, text: string, caret: EditorPosition): void {
        const { editor } = this.language;
        this.accepting = true;
        try {
            editor.applyEdits([{ range, text }]);
            editor.setCaret(caret);
        } finally {
            this.accepting = false;
        }
    }

    /* Tab takes the suggestion on screen before any feature that expands on Tab; without one it is left alone. */
    private tab(event: KeyboardEvent): boolean {
        const { phase } = this;
        if (phase.kind !== 'showing' || event.isComposing) {
            return false;
        }
        if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
            return false;
        }
        const { popups } = this.language;
        if (!phase.manual && (popups.slot('completion').get() !== null || popups.slot('pick').get() !== null)) {
            return false;
        }
        return this.accept();
    }

    private key(event: KeyboardEvent): boolean {
        if (isShortcut(this.language.shortcuts.suggestInline, event)) {
            return this.trigger();
        }
        if (event.isComposing) {
            return false;
        }
        const { phase } = this;
        if (event.key === 'Escape' && (phase.kind === 'showing' || (phase.kind === 'asking' && phase.manual))) {
            this.hide();
            return true;
        }
        if (phase.kind !== 'showing') {
            return false;
        }
        if (isShortcut(this.language.shortcuts.acceptGhostWord, event) && this.acceptWord()) {
            return true;
        }
        // With one suggestion there is nothing to cycle to, so the key goes on to the editor and types its character.
        if (
            phase.suggestions.length > 1 &&
            event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            (event.code === 'BracketRight' || event.code === 'BracketLeft')
        ) {
            this.cycle(event.code === 'BracketRight' ? 1 : -1);
            return true;
        }
        return false;
    }

    private edited(change: EditorTextChange): void {
        if (this.accepting) {
            return;
        }
        const source = this.sources.find((entry) => entry.source.automatic && entry.source.enabled)?.source;
        if (source === undefined || change.source !== 'input') {
            this.hide();
            return;
        }
        const timer = this.timers.set(() => this.fire(timer), DELAY_MS);
        this.enter({ kind: 'scheduled', source, timer });
    }

    private fire(timer: unknown): void {
        const { phase } = this;
        if (phase.kind === 'scheduled' && phase.timer === timer) {
            void this.ask(phase.source, 2);
        }
    }

    /* A caret that left the place of the suggestion, or of the request still out, puts it away. */
    private moved(): void {
        if (this.accepting) {
            return;
        }
        const { phase } = this;
        const { editor } = this.language;
        const caret = editor.getCaret();
        if (phase.kind === 'asking' && comparePositions(phase.caret, caret) !== 0) {
            this.hide();
            return;
        }
        const suggestion = this.current;
        if (suggestion === null) {
            return;
        }
        if (editor.getSelections().length !== 1 || !continuesAt(suggestion, caret, (range) => editor.textInRange(range))) {
            this.hide();
        }
    }

    private async ask(source: InlineSuggestionSource, triggerKind: 1 | 2): Promise<void> {
        const { editor } = this.language;
        if (!this.asks(source) || editor.getSelections().length !== 1 || editor.isReadOnly?.() === true) {
            return;
        }
        const asking: Asking = { kind: 'asking', source, controller: new AbortController(), caret: editor.getCaret(), manual: triggerKind === 1 };
        this.enter(asking);
        if (this.phase !== asking) {
            return;
        }
        let found: readonly InlineSuggestion[] = [];
        try {
            found = await source.suggest({ caret: asking.caret, triggerKind, signal: asking.controller.signal });
        } catch {
            // A source that fails gives no suggestion; the next pause asks again.
        }
        if (this.phase !== asking) {
            return;
        }
        // The answer ends the request without aborting it; there is nothing left to let go of.
        this.phase = { kind: 'idle' };
        if (!this.asks(source) || comparePositions(editor.getCaret(), asking.caret) !== 0 || found.length === 0) {
            return;
        }
        this.enter({ kind: 'showing', source, suggestions: found, index: 0, manual: asking.manual });
    }

    private draw(): void {
        const { editor } = this.language;
        const suggestion = this.current;
        editor.setGhostText(
            suggestion === null
                ? null
                : {
                      position: editor.getCaret(),
                      text: suggestion.rest,
                      ...(suggestion.accessory === undefined ? {} : { accessory: suggestion.accessory })
                  }
        );
    }
}
