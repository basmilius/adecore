import type { EditorPosition, EditorTextChange } from '@adecore/editor';
import type { InlineCompletionItem, InlineCompletionResult, Range } from '@adecore/lsp';
import { comparePositions } from './diagnostics-model.ts';
import type { EditorLanguage } from './editor-language.ts';
import { KEY_PRIORITY } from './key-priority.ts';
import { isShortcut } from './shortcut-keys.ts';
import { parseSnippet } from './snippet.ts';
import { realTimers, type Timers } from './timers.ts';

const METHOD = 'textDocument/inlineCompletion';
/* How long typing rests before a suggestion is asked. */
const DELAY_MS = 300;

/* A suggestion as the text it inserts at the caret: what follows what was already typed of it. */
export interface InlineSuggestion {
    readonly item: InlineCompletionItem;
    /* What replaces `range` on acceptance. */
    readonly text: string;
    readonly range: Range;
    /* What the ghost shows after the caret. */
    readonly rest: string;
}

export function itemsOf(result: InlineCompletionResult): InlineCompletionItem[] {
    if (result === null) {
        return [];
    }
    return Array.isArray(result) ? result : result.items;
}

/*
 * A server's item as a suggestion at the caret, or null when it does not continue what the line holds: the text the
 * item replaces up to the caret must start its insert text, so the rest can stand after the caret.
 */
export function suggestionOf(item: InlineCompletionItem, caret: EditorPosition, textOf: (range: Range) => string): InlineSuggestion | null {
    const text = typeof item.insertText === 'string' ? item.insertText : parseSnippet(item.insertText.value).text;
    const range = item.range ?? { start: caret, end: caret };
    if (comparePositions(range.start, caret) > 0 || comparePositions(range.end, caret) < 0) {
        return null;
    }
    const typed = textOf({ start: range.start, end: caret });
    if (!text.startsWith(typed)) {
        return null;
    }
    const rest = text.slice(typed.length);
    return rest === '' ? null : { item, text, range, rest };
}

/*
 * Suggestions a server writes ahead of the caret, drawn as ghost text: asked a moment after typing stops, or at
 * once with the `suggestInline` key of the host. Tab takes the suggestion, Alt+] and Alt+[ step through the others,
 * Escape and any key that moves away put it away. Off unless the host turns it on, since a host may draw
 * suggestions of its own in the same place.
 */
export class InlineCompletionFeature {
    private readonly language: EditorLanguage;
    private readonly timers: Timers;
    private enabled = false;
    private suggestions: InlineSuggestion[] = [];
    private index = 0;
    private timer: unknown = null;
    private controller: AbortController | null = null;
    private revision = 0;
    private accepting = false;

    constructor(language: EditorLanguage, timers: Timers = realTimers) {
        this.language = language;
        this.timers = timers;
        const { editor } = language;
        const offs = [
            language.onKey((event) => this.key(event), KEY_PRIORITY.inlineCompletion),
            editor.onTextChange((change) => this.edited(change)),
            editor.onCaret(() => queueMicrotask(() => this.moved()))
        ];
        language.onDispose(() => {
            this.hide();
            for (const off of offs) {
                off();
            }
        });
    }

    get supported(): boolean {
        const { service } = this.language;
        return service.inlineCompletions !== undefined && service.supports(METHOD, this.language.uri);
    }

    get isEnabled(): boolean {
        return this.enabled;
    }

    /* The suggestion drawn now, or null. */
    get current(): InlineSuggestion | null {
        return this.suggestions[this.index] ?? null;
    }

    configure(settings: { readonly enabled?: boolean }): void {
        this.enabled = settings.enabled === true;
        if (!this.enabled) {
            this.hide();
        }
    }

    /* Asks for suggestions at the caret now, as a person asking for one does. */
    trigger(): void {
        this.timers.clear(this.timer);
        void this.ask(1);
    }

    /* Takes the drawn suggestion into the text; false when there is none. */
    accept(): boolean {
        const suggestion = this.current;
        if (suggestion === null) {
            return false;
        }
        const { editor, service, uri } = this.language;
        this.accepting = true;
        try {
            editor.applyEdits([{ range: suggestion.range, text: suggestion.text }]);
        } finally {
            this.accepting = false;
        }
        this.hide();
        const { command } = suggestion.item;
        if (command !== undefined && service.supports('workspace/executeCommand', uri)) {
            void service.executeCommand(uri, command).catch(() => undefined);
        }
        return true;
    }

    /* Steps to the next or the previous suggestion. */
    cycle(step: 1 | -1): void {
        if (this.suggestions.length > 1) {
            this.index = (this.index + step + this.suggestions.length) % this.suggestions.length;
            this.draw();
        }
    }

    hide(): void {
        this.revision++;
        this.timers.clear(this.timer);
        this.controller?.abort();
        if (this.suggestions.length > 0) {
            this.suggestions = [];
            this.language.editor.setGhostText(null);
        }
    }

    private key(event: KeyboardEvent): boolean {
        if (isShortcut(this.language.shortcuts.suggestInline, event) && this.enabled) {
            this.trigger();
            return true;
        }
        if (this.current === null || event.isComposing) {
            return false;
        }
        if (event.key === 'Tab' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
            return this.accept();
        }
        if (event.key === 'Escape') {
            this.hide();
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
        if (this.enabled && change.source === 'input' && this.supported) {
            this.timer = this.timers.set(() => void this.ask(2), DELAY_MS);
        }
    }

    /* A caret that left the place of the suggestion puts it away. */
    private moved(): void {
        const suggestion = this.current;
        if (suggestion === null) {
            return;
        }
        const caret = this.language.editor.getCaret();
        const selections = this.language.editor.getSelections();
        if (selections.length !== 1 || suggestionOf(suggestion.item, caret, (range) => this.language.editor.textInRange(range)) === null) {
            this.hide();
        }
    }

    private async ask(triggerKind: 1 | 2): Promise<void> {
        const { editor, service, uri } = this.language;
        if (!this.enabled || !this.supported || editor.getSelections().length !== 1 || editor.isReadOnly?.() === true) {
            return;
        }
        this.controller?.abort();
        const controller = new AbortController();
        this.controller = controller;
        const revision = this.revision;
        const caret = editor.getCaret();
        try {
            const result = await service.inlineCompletions!(uri, caret, { triggerKind }, { signal: controller.signal });
            if (revision !== this.revision || comparePositions(editor.getCaret(), caret) !== 0) {
                return;
            }
            this.suggestions = itemsOf(result).flatMap((item) => suggestionOf(item, caret, (range) => editor.textInRange(range)) ?? []);
            this.index = 0;
            this.draw();
        } catch {
            // A refusal or a failing server is no suggestion; the next pause asks again.
        }
    }

    private draw(): void {
        const suggestion = this.current;
        this.language.editor.setGhostText(suggestion === null ? null : { position: this.language.editor.getCaret(), text: suggestion.rest });
    }
}
