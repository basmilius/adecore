import { isBlank } from './line-text.ts';
import type { DocumentLine } from './rope.ts';
import type { DocumentChange, TextEdit } from './types.ts';

/* Which lines lose the spaces and tabs at their end. */
export type TrailingWhitespace = 'off' | 'modified' | 'all';

export interface WhitespaceCleanupOptions {
    /* Off unless set. `modified` reads the lines changed since the document was last marked as saved. */
    trailingWhitespace?: TrailingWhitespace;
    /* The lines a caret is on keep their trailing whitespace, so a person typing there does not lose it. On unless false. */
    keepCaretLines?: boolean;
    /* The blank lines at the end go, up to the last line with text and its line break. Off unless true. */
    removeTrailingBlankLines?: boolean;
    /* A text that does not end in a line break gets one, in the style of its first. Off unless true. */
    ensureFinalNewline?: boolean;
}

/* What the cleanup reads of a document. */
export interface CleanupSource {
    lineCount: number;
    line(index: number): DocumentLine;
    newline(index: number): string;
    /* Whether trailing whitespace starting at this column belongs to the text itself, such as inside a multiline string. */
    keeps?(line: number, column: number): boolean;
}

export interface CleanupLines {
    modified(line: number): boolean;
    carets: ReadonlySet<number>;
}

/* The edits that clean up the whitespace of a text before it is saved, all in the coordinates of the text as it is. */
export function planWhitespaceCleanup(source: CleanupSource, options: WhitespaceCleanupOptions, lines: CleanupLines): TextEdit[] {
    const edits: TextEdit[] = [];
    let lastText = source.lineCount - 1;

    if (options.removeTrailingBlankLines === true) {
        while (lastText >= 0 && isBlank(source.line(lastText).text)) {
            lastText--;
        }
    }

    const mode = options.trailingWhitespace ?? 'off';

    for (let index = 0; mode !== 'off' && index <= lastText; index++) {
        const line = source.line(index);
        const trailing = /[\t ]+$/.exec(line.text);

        if (trailing === null) {
            continue;
        }

        const kept = trailing.index;

        if (
            (mode === 'modified' && !lines.modified(index)) ||
            (options.keepCaretLines !== false && lines.carets.has(index)) ||
            source.keeps?.(index, kept) === true
        ) {
            continue;
        }

        edits.push({ from: line.start + kept, to: line.end, text: '' });
    }

    const last = source.line(source.lineCount - 1);

    if (lastText < source.lineCount - 1) {
        edits.push({ from: lastText < 0 ? 0 : source.line(lastText + 1).start, to: last.end, text: '' });
    }

    // A last line that is empty, or that the cleanup emptied, already stands after a line break.
    const end = source.line(source.lineCount - 1);
    const emptied = edits.some((edit) => edit.from === end.start && edit.to === end.end);

    if (options.ensureFinalNewline === true && lastText === source.lineCount - 1 && end.text !== '' && !emptied) {
        edits.push({ from: end.end, to: end.end, text: source.lineCount > 1 ? source.newline(0) : '\n' });
    }

    return edits;
}

/*
 * The stretches of a text that changed since it was last marked as saved, followed through every
 * change after it, undo included. A deletion leaves an empty stretch, which still marks its line.
 */
export class ModifiedStretches {
    private stretches: { from: number; to: number }[] = [];

    clear(): void {
        this.stretches = [];
    }

    /* One transaction, its changes in the coordinates of the text before it. */
    record(changes: readonly DocumentChange[]): void {
        const ordered = [...changes].sort((left, right) => left.from - right.from);
        let index = 0;
        let shift = 0;

        // The stretches are in order and apart, so one walk over the changes maps all their offsets.
        const map = (offset: number, end: boolean): number => {
            for (; index < ordered.length; index++) {
                const change = ordered[index]!;

                if (offset < change.from || (offset === change.from && !end)) {
                    break;
                }

                if (offset < change.to) {
                    return change.from + shift + (end ? change.insertedLength : 0);
                }

                shift += change.insertedLength - (change.to - change.from);
            }

            return offset + shift;
        };

        const next = this.stretches.map((stretch) => ({ from: map(stretch.from, false), to: map(stretch.to, true) }));
        shift = 0;

        for (const change of ordered) {
            const from = change.from + shift;
            next.push({ from, to: from + change.insertedLength });
            shift += change.insertedLength - (change.to - change.from);
        }

        next.sort((left, right) => left.from - right.from);
        this.stretches = [];

        for (const stretch of next) {
            const previous = this.stretches.at(-1);

            if (previous !== undefined && stretch.from <= previous.to) {
                previous.to = Math.max(previous.to, stretch.to);
            } else {
                this.stretches.push({ ...stretch });
            }
        }
    }

    /* The zero-based lines the stretches touch, in order. A stretch that ends at the start of a line, such as an inserted line, does not touch it. */
    lines(lineAt: (offset: number) => number, lineStart: (line: number) => number): number[] {
        const result: number[] = [];

        for (const { from, to } of this.stretches) {
            const first = lineAt(from);
            let last = lineAt(to);

            if (last > first && lineStart(last) === to) {
                last--;
            }

            for (let line = Math.max(first, (result.at(-1) ?? -1) + 1); line <= last; line++) {
                result.push(line);
            }
        }

        return result;
    }
}
