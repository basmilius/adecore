import { expect, test } from 'bun:test';
import { diffDisplay, diffDocument, diffSplit, parsePatch, patchOf, sourceLineOf, type DiffLineRow } from './index.ts';

const OLD = 'head\nkeep\nold\nmiddle\ngone\ntail\n';
const NEW = 'head\nkeep\nnew\nmiddle\ntail\n';

function unifiedRows(): readonly DiffLineRow[] {
    return diffDisplay(diffDocument(patchOf(OLD, NEW, 1), { old: OLD, new: NEW })).rows;
}

function lineOf(rows: readonly DiffLineRow[], change: DiffLineRow['change'], text: number): number {
    return rows.findIndex((row) => row.change === change && (row.new ?? row.old)!.number === text);
}

test('a context or added line opens on its own line of the new file with the caret in the same column', () => {
    const rows = unifiedRows();

    expect(sourceLineOf(rows, lineOf(rows, 'context', 2), 2, 'new')).toEqual({ line: 2, column: 3 });
    expect(sourceLineOf(rows, lineOf(rows, 'insert', 3), 1, 'new')).toEqual({ line: 3, column: 2 });
});

test('a removed line opens on the line that took its place, or on the line before it at the end of its hunk', () => {
    const rows = unifiedRows();

    expect(sourceLineOf(rows, lineOf(rows, 'delete', 3), 2, 'new')).toEqual({ line: 3, column: 1 });
    expect(sourceLineOf(rows, lineOf(rows, 'delete', 5), 0, 'new')).toEqual({ line: 5, column: 1 });

    const end = diffDisplay(diffDocument(parsePatch('@@ -1,2 +1,1 @@\n keep\n-last\n'), undefined)).rows;

    expect(sourceLineOf(end, 1, 0, 'new')).toEqual({ line: 1, column: 1 });
});

test('the old pane of a split diff opens a changed line on the new line beside it, at its start', () => {
    const split = diffSplit(diffDocument(patchOf(OLD, NEW, 1), { old: OLD, new: NEW }));
    const oldRows = split.aligned.flatMap((entry) => (entry.kind === 'line' && entry.old !== undefined ? [entry.row] : []));
    const pair = oldRows.findIndex((row) => row.change === 'pair');

    expect(sourceLineOf(oldRows, pair, 2, 'old')).toEqual({ line: 3, column: 1 });
    expect(sourceLineOf(oldRows, 0, 3, 'old')).toEqual({ line: 2, column: 4 });
    expect(
        sourceLineOf(
            split.new.rows,
            split.new.rows.findIndex((row) => row.change === 'pair'),
            2,
            'new'
        )
    ).toEqual({ line: 3, column: 3 });
});

test('a diff that deletes the file, or a caret past the rows, has no line to open', () => {
    const deleted = diffDisplay(diffDocument(parsePatch('@@ -1,2 +0,0 @@\n-one\n-two\n'), undefined)).rows;

    expect(sourceLineOf(deleted, 0, 0, 'new')).toBeNull();
    expect(sourceLineOf(unifiedRows(), 99, 0, 'new')).toBeNull();
});
