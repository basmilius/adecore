import type { DiffLineRow } from './diff-document.ts';
import type { Hunk } from './patch-parser.ts';

export interface DiffSourceLine {
    /* Both count from 1, in the new file. */
    readonly line: number;
    readonly column: number;
}

function newNumberIn(rows: readonly DiffLineRow[], from: number, step: 1 | -1, hunk: number | undefined): number | null {
    for (let index = from + step; index >= 0 && index < rows.length; index += step) {
        const row = rows[index]!;

        if (row.hunk !== hunk) {
            return null;
        }

        if (row.new !== undefined) {
            return row.new.number;
        }
    }

    return null;
}

/*
 * The line of the new file that took the place of a removed line, from its own hunk only. Past the last line
 * of the last hunk there may be no line at all, so there it is the line before, or none in a file left empty.
 */
function removedLineOf(rows: readonly DiffLineRow[], line: number, hunks: readonly Pick<Hunk, 'newStart'>[]): number | null {
    const row = rows[line]!;
    const next = newNumberIn(rows, line, 1, row.hunk);

    if (next !== null) {
        return next;
    }

    const previous = newNumberIn(rows, line, -1, row.hunk);
    const hunk = row.hunk === undefined ? undefined : hunks[row.hunk];
    // The lines of the new file before the removed one.
    const before = previous ?? hunk?.newStart;

    if (before === undefined) {
        return null;
    }

    if (row.hunk !== undefined && row.hunk < hunks.length - 1) {
        return before + 1;
    }

    return before > 0 ? before : null;
}

/*
 * The place in the new file that a caret on a line of a diff stands for. `rows` are the rows of one pane with
 * both of their sides, `hunks` the document's, `line` and `character` count from 0 the way the editor's caret
 * does, and `side` is the text the pane shows for a changed line. A removed line stands for the line that took
 * its place; the column carries over only where the pane shows the new text. Null where the new file has no
 * line at all, such as a diff that deletes the file.
 */
export function sourceLineOf(
    rows: readonly DiffLineRow[],
    hunks: readonly Pick<Hunk, 'newStart'>[],
    line: number,
    character: number,
    side: 'old' | 'new'
): DiffSourceLine | null {
    const row = rows[line];

    if (row === undefined) {
        return null;
    }

    if (row.new !== undefined) {
        return { line: row.new.number, column: row.change === 'context' || side === 'new' ? character + 1 : 1 };
    }

    const found = removedLineOf(rows, line, hunks);

    return found === null ? null : { line: found, column: 1 };
}
