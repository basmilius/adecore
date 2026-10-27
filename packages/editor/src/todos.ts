import { DEFAULT_TODO_WORDS, type DocumentModel, type TodoMatch } from '@adecore/editor-core';
import { overlayTokens } from './semantic.ts';
import type { LineToken } from './types.ts';

const TODO_COLOR = 'var(--editor-todo)';
const ITALIC = 1;
/* The marks in the scroll track read the whole document, so they wait for a pause in editing as the folds do. */
const TODO_DELAY_MS = 300;
const TODO_LIMIT = 2_000_000;
const CACHED_LINES = 600;

/* The text is kept with the mark, since the list is only read again after a pause and the offsets may be stale until then. */
export type TodoMark = TodoMatch & { readonly text: string };

/*
 * The TODO comments of a view: drawn in their own color over the grammar's on the lines being painted,
 * and listed for the whole document a moment after the last edit, for the ticks in the scroll track.
 */
export class TodoMarks {
    private readonly model: DocumentModel;
    private readonly changed: () => void;
    private words: readonly string[] = DEFAULT_TODO_WORDS;
    /* Empty until the first `configure`, which reads the document. */
    private language = '';
    private revision = -1;
    private readonly lines = new Map<number, { base: readonly LineToken[] | null; result: readonly LineToken[] | null }>();
    private timer: ReturnType<typeof setTimeout> | undefined;
    private all: readonly TodoMark[] = [];
    /* Counts every new list, so a painter can tell its ticks are stale. */
    version = 0;

    constructor(model: DocumentModel, changed: () => void) {
        this.model = model;
        this.changed = changed;
    }

    get marks(): readonly TodoMark[] {
        return this.all;
    }

    configure(language: string | undefined, words: readonly string[] | undefined): void {
        const nextLanguage = language ?? 'plaintext';
        const nextWords = words ?? DEFAULT_TODO_WORDS;

        if (nextLanguage === this.language && nextWords.join('\n') === this.words.join('\n')) {
            return;
        }

        this.language = nextLanguage;
        this.words = nextWords;
        this.revision = -1;
        this.refresh();
    }

    /* The line's tokens with its TODOs drawn over them, the same array for as long as neither changed. */
    styled(line: number, base: readonly LineToken[] | null): readonly LineToken[] | null {
        if (this.words.length === 0) {
            return base;
        }

        const revision = this.model.getRevision();

        if (revision !== this.revision || this.lines.size > CACHED_LINES) {
            this.revision = revision;
            this.lines.clear();
        }

        const cached = this.lines.get(line);

        if (cached !== undefined && cached.base === base) {
            return cached.result;
        }

        const matches = this.model.findTodos(this.language, { words: this.words }, line, line);
        let result = base;

        if (matches.length > 0) {
            const { start, end } = this.model.getLine(line);
            const spans = matches.map((match) => ({ from: match.from - start, to: match.to - start, color: TODO_COLOR, fontStyle: ITALIC }));
            result = overlayTokens(base ?? [{ length: end - start, color: '', fontStyle: 0 }], spans);
        }

        this.lines.set(line, { base, result });

        return result;
    }

    schedule(): void {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.refresh(), TODO_DELAY_MS);
    }

    /* Reads the TODOs of the whole document now, which otherwise waits for a pause in editing. */
    refresh(): void {
        clearTimeout(this.timer);
        const found = this.words.length === 0 || this.model.getLength() > TODO_LIMIT ? [] : this.model.findTodos(this.language, { words: this.words });
        const next = found.map((match) => ({ ...match, text: this.model.slice(match.from, match.to) }));

        if (next.length === 0 && this.all.length === 0) {
            return;
        }

        this.all = next;
        this.version++;
        this.changed();
    }

    dispose(): void {
        clearTimeout(this.timer);
    }
}
