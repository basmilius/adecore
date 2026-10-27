import type { EditorTextChange } from '@adecore/editor';
import type { LinkedEditingRanges } from '@adecore/lsp';
import type { EditorLanguage } from './editor-language.ts';
import { realTimers, type Timers } from './timers.ts';

const METHOD = 'textDocument/linkedEditingRange';
/* How long the caret rests before the ranges around it are asked. */
const DELAY_MS = 100;

interface Span {
    from: number;
    to: number;
}

interface Session {
    /* Offsets in the current text, in the order the server gave them. */
    spans: Span[];
    pattern: RegExp | null;
}

/* The server's word pattern, anchored, or null when it gave none or one that does not compile. */
export function wordPatternOf(ranges: LinkedEditingRanges): RegExp | null {
    if (ranges.wordPattern === undefined) {
        return null;
    }
    try {
        return new RegExp(`^(?:${ranges.wordPattern})$`, 'u');
    } catch {
        return null;
    }
}

/*
 * Ranges a server says are edited together, such as the names of a start tag and its end tag: a change inside
 * one goes into every other, in the undo step of the key. The ranges are asked once the caret rests, and the link
 * ends when an edit falls outside them, the text stops matching the server's word pattern, or there is more
 * than one caret.
 */
export class LinkedEditingFeature {
    private readonly language: EditorLanguage;
    private readonly timers: Timers;
    private session: Session | null = null;
    private timer: unknown = null;
    private controller: AbortController | null = null;
    private revision = 0;
    private mirroring = false;
    private enabled = true;

    constructor(language: EditorLanguage, timers: Timers = realTimers) {
        this.language = language;
        this.timers = timers;
        const { editor } = language;
        const offs = [editor.onTextChange((change) => this.edited(change)), editor.onCaret(() => this.moved())];
        language.onDispose(() => {
            this.stop();
            for (const off of offs) {
                off();
            }
        });
    }

    get supported(): boolean {
        const { service } = this.language;
        return this.enabled && service.linkedEditingRanges !== undefined && service.supports(METHOD, this.language.uri);
    }

    /* Whether ranges are linked now. */
    get isActive(): boolean {
        return this.session !== null;
    }

    /* Off, nothing is linked; on unless false. */
    configure(settings: { readonly enabled?: boolean }): void {
        this.enabled = settings.enabled !== false;
        if (!this.enabled) {
            this.stop();
        }
    }

    private stop(): void {
        this.session = null;
        this.timers.clear(this.timer);
        this.controller?.abort();
    }

    private caretOffset(): number | null {
        const { editor } = this.language;
        const selections = editor.getSelections();
        if (selections.length !== 1) {
            return null;
        }
        const { start, end } = selections[0]!;
        return start.line === end.line && start.character === end.character ? editor.offsetAt(start) : null;
    }

    private moved(): void {
        if (this.mirroring) {
            return;
        }
        // The caret moves before the text change of the same key is told, so the session is checked once both are in.
        queueMicrotask(() => {
            const offset = this.caretOffset();
            if (offset !== null && this.session?.spans.some((span) => span.from <= offset && offset <= span.to)) {
                return;
            }
            this.stop();
            if (offset !== null && this.supported) {
                this.timer = this.timers.set(() => void this.ask(offset), DELAY_MS);
            }
        });
    }

    private async ask(offset: number): Promise<void> {
        const { editor, service, uri } = this.language;
        const revision = this.revision;
        const controller = new AbortController();
        this.controller = controller;
        try {
            const ranges = await service.linkedEditingRanges!(uri, editor.positionAt(offset), { signal: controller.signal });
            if (ranges === null || ranges.ranges.length < 2 || revision !== this.revision || this.caretOffset() !== offset) {
                return;
            }
            this.session = {
                spans: ranges.ranges.map((range) => ({ from: editor.offsetAt(range.start), to: editor.offsetAt(range.end) })),
                pattern: wordPatternOf(ranges)
            };
        } catch {
            // No ranges is no link; the next rest of the caret asks again.
        }
    }

    private edited(change: EditorTextChange): void {
        const revision = ++this.revision;
        const session = this.session;
        if (this.mirroring || session === null) {
            return;
        }
        const edit = change.changes[0];
        if (change.source === 'external' || change.changes.length !== 1 || edit === undefined || edit.range.start.line !== edit.range.end.line) {
            this.stop();
            return;
        }
        const from = this.language.editor.offsetAt(edit.range.start);
        const removed = edit.range.end.character - edit.range.start.character;
        const own = session.spans.findIndex((span) => span.from <= from && from + removed <= span.to);
        if (own === -1) {
            this.stop();
            return;
        }
        const delta = edit.text.length - removed;
        const edited = session.spans[own]!;
        session.spans = session.spans.map((span, index) =>
            index === own ? { from: span.from, to: span.to + delta } : span.from > edited.from ? { from: span.from + delta, to: span.to + delta } : span
        );
        queueMicrotask(() => this.mirror(own, revision));
    }

    private mirror(own: number, revision: number): void {
        const session = this.session;
        if (session === null || revision !== this.revision) {
            return;
        }
        const { editor } = this.language;
        const text = editor.getText();
        const source = session.spans[own]!;
        const value = text.slice(source.from, source.to);
        if (session.pattern !== null && value !== '' && !session.pattern.test(value)) {
            this.stop();
            return;
        }
        const others = session.spans
            .map((span, index) => ({ span, index }))
            .filter(({ span, index }) => index !== own && text.slice(span.from, span.to) !== value);
        if (others.length === 0) {
            return;
        }
        this.mirroring = true;
        try {
            const applied = editor.applyEdits(
                others.map(({ span }) => ({ range: { start: editor.positionAt(span.from), end: editor.positionAt(span.to) }, text: value })),
                { mergeUndo: true }
            );
            if (!applied) {
                this.stop();
                return;
            }
        } finally {
            this.mirroring = false;
        }
        // Each replaced span moves every span after it by what its length changed.
        const changed = others.map(({ span }) => ({ at: span.from, delta: value.length - (span.to - span.from) })).sort((left, right) => left.at - right.at);
        const shift = (offset: number): number => offset + changed.filter((entry) => entry.at < offset).reduce((total, entry) => total + entry.delta, 0);
        session.spans = session.spans.map((span, index) => {
            const from = shift(span.from);
            const replaced = others.some((other) => other.index === index);
            return { from, to: replaced ? from + value.length : shift(span.to) };
        });
    }
}
