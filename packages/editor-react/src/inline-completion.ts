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
    /* Fills the element after the first line of the ghost, such as the keys that take it. */
    readonly accessory?: (container: HTMLElement) => void;
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
    /* The suggestions it gave are no longer drawn, for a source that mounted something with them. */
    cleared?(): void;
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
    private owner: InlineSuggestionSource | null = null;
    private suggestions: readonly InlineSuggestion[] = [];
    private index = 0;
    private manual = false;
    private timer: unknown = null;
    private timerSource: InlineSuggestionSource | null = null;
    private pending: {
        readonly controller: AbortController;
        readonly source: InlineSuggestionSource;
        readonly caret: EditorPosition;
        readonly manual: boolean;
    } | null = null;
    private revision = 0;
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
        return this.suggestions[this.index] ?? null;
    }

    holds(source: InlineSuggestionSource): boolean {
        return this.current !== null && this.owner === source;
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
            if (this.timerSource === source) {
                this.timers.clear(this.timer);
                this.timerSource = null;
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

    /* Whether the source has a suggestion drawn or a request out. */
    private uses(source: InlineSuggestionSource): boolean {
        return this.owner === source || this.pending?.source === source;
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
        const suggestion = this.current;
        const source = this.owner;
        if (suggestion === null || source === null) {
            return false;
        }
        const { editor } = this.language;
        this.accepting = true;
        try {
            editor.applyEdits([{ range: suggestion.range, text: suggestion.text }]);
            editor.setCaret(endOfInsertion(suggestion.range.start, suggestion.text));
        } finally {
            this.accepting = false;
        }
        this.hide();
        source.accepted?.(suggestion);
        return true;
    }

    /* Takes the first word of a suggestion that allows it; the rest stays drawn after it. */
    acceptWord(): boolean {
        const suggestion = this.current;
        const source = this.owner;
        if (suggestion === null || source === null || suggestion.words !== true) {
            return false;
        }
        const { editor } = this.language;
        const caret = editor.getCaret();
        const word = firstWord(suggestion.rest);
        const next = endOfInsertion(caret, word);
        this.accepting = true;
        try {
            editor.applyEdits([{ range: { start: caret, end: caret }, text: word }]);
            editor.setCaret(next);
        } finally {
            this.accepting = false;
        }
        const rest = suggestion.rest.slice(word.length);
        this.suggestions = rest.trim() === '' ? [] : [{ ...suggestion, range: { start: next, end: next }, text: rest, rest }];
        if (this.suggestions.length === 0) {
            this.owner = null;
        }
        this.index = 0;
        this.draw();
        // Last, so a source that unregisters itself in it finds the state settled and is not cleared a second time by `hide`.
        source.cleared?.();
        return true;
    }

    cycle(step: 1 | -1): void {
        if (this.suggestions.length > 1) {
            this.index = (this.index + step + this.suggestions.length) % this.suggestions.length;
            this.draw();
        }
    }

    /* Puts the suggestions away and ends a request that is still out. */
    hide(): void {
        this.revision++;
        this.timers.clear(this.timer);
        this.pending?.controller.abort();
        this.pending = null;
        if (this.suggestions.length > 0) {
            this.suggestions = [];
            this.language.editor.setGhostText(null);
        }
        const owner = this.owner;
        this.owner = null;
        owner?.cleared?.();
    }

    /* Tab takes the suggestion on screen before any feature that expands on Tab; without one it is left alone. */
    private tab(event: KeyboardEvent): boolean {
        if (this.current === null || event.isComposing) {
            return false;
        }
        if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
            return false;
        }
        const { popups } = this.language;
        if (!this.manual && (popups.slot('completion').get() !== null || popups.slot('pick').get() !== null)) {
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
        if (event.key === 'Escape' && (this.current !== null || this.pending?.manual === true)) {
            this.hide();
            return true;
        }
        if (this.current === null) {
            return false;
        }
        if (isShortcut(this.language.shortcuts.acceptGhostWord, event) && this.acceptWord()) {
            return true;
        }
        if (event.altKey && !event.ctrlKey && !event.metaKey && (event.code === 'BracketRight' || event.code === 'BracketLeft')) {
            this.cycle(event.code === 'BracketRight' ? 1 : -1);
            return true;
        }
        return false;
    }

    private edited(change: EditorTextChange): void {
        if (this.accepting) {
            return;
        }
        this.hide();
        const source = this.sources.find((entry) => entry.source.automatic && entry.source.enabled)?.source;
        if (source !== undefined && change.source === 'input') {
            this.timerSource = source;
            this.timer = this.timers.set(() => void this.ask(source, 2), DELAY_MS);
        }
    }

    /* A caret that left the place of the suggestion, or of the request still out, puts it away. */
    private moved(): void {
        if (this.accepting) {
            return;
        }
        const { editor } = this.language;
        const caret = editor.getCaret();
        if (this.pending !== null && comparePositions(this.pending.caret, caret) !== 0) {
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
        if (
            !source.enabled ||
            !this.sources.some((entry) => entry.source === source) ||
            editor.getSelections().length !== 1 ||
            editor.isReadOnly?.() === true
        ) {
            return;
        }
        this.hide();
        const controller = new AbortController();
        const caret = editor.getCaret();
        const pending = { controller, source, caret, manual: triggerKind === 1 };
        this.pending = pending;
        const revision = this.revision;
        let found: readonly InlineSuggestion[] = [];
        try {
            found = await source.suggest({ caret, triggerKind, signal: controller.signal });
        } catch {
            // A source that fails gives no suggestion; the next pause asks again.
        }
        if (this.pending !== pending) {
            return;
        }
        this.pending = null;
        // An app's setting can turn a source off without telling this feature, so a late answer is drawn only for a source still asked.
        const stillAsked = source.enabled && this.sources.some((entry) => entry.source === source);
        if (!stillAsked || revision !== this.revision || comparePositions(editor.getCaret(), caret) !== 0 || found.length === 0) {
            return;
        }
        this.owner = source;
        this.suggestions = found;
        this.index = 0;
        this.manual = pending.manual;
        this.draw();
    }

    private draw(): void {
        const suggestion = this.current;
        this.language.editor.setGhostText(
            suggestion === null
                ? null
                : {
                      position: this.language.editor.getCaret(),
                      text: suggestion.rest,
                      ...(suggestion.accessory === undefined ? {} : { accessory: suggestion.accessory })
                  }
        );
    }
}
