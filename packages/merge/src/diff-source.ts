import type { DiffLineRow } from './diff-document.ts';

export interface DiffSourceLine {
    /* Both count from 1, in the new file. */
    readonly line: number;
    readonly column: number;
}

function newNumberNear(rows: readonly DiffLineRow[], from: number, step: 1 | -1, hunk: number | undefined): number | null {
    for (let index = from + step; index >= 0 && index < rows.length; index += step) {
        const row = rows[index]!;

        if (hunk !== undefined && row.hunk !== hunk) {
            return null;
        }

        if (row.new !== undefined) {
            return row.new.number;
        }
    }

    return null;
}

/*
 * The place in the new file that a caret on a line of a diff stands for. `rows` are the rows of one pane with
 * both of their sides, `line` and `character` count from 0 the way the editor's caret does, and `side` is the
 * text the pane shows for a changed line. A removed line stands for the line that took its place, or at the
 * end of its hunk the line before it; the column carries over only where the pane shows the new text. Null
 * where the new file has no line at all, such as a diff that deletes the file.
 */
export function sourceLineOf(rows: readonly DiffLineRow[], line: number, character: number, side: 'old' | 'new'): DiffSourceLine | null {
    const row = rows[line];

    if (row === undefined) {
        return null;
    }

    if (row.new !== undefined) {
        return { line: row.new.number, column: row.change === 'context' || side === 'new' ? character + 1 : 1 };
    }

    const found =
        newNumberNear(rows, line, 1, row.hunk) ??
        newNumberNear(rows, line, -1, row.hunk) ??
        newNumberNear(rows, line, 1, undefined) ??
        newNumberNear(rows, line, -1, undefined);

    return found === null ? null : { line: found, column: 1 };
}
