import { expect, test } from 'bun:test';
import { diffDisplay, diffDocument, diffSplit, parsePatch, patchOf, sourceLineOf, type DiffDocument, type DiffLineRow } from './index.ts';

const OLD = 'head\nkeep\nold\nmiddle\ngone\ntail\n';
const NEW = 'head\nkeep\nnew\nmiddle\ntail\n';

function snapshots(): DiffDocument {
    return diffDocument(patchOf(OLD, NEW, 1), { old: OLD, new: NEW });
}

function patch(text: string): DiffDocument {
    return diffDocument(parsePatch(text), undefined);
}

/* The rows of the old pane of a split, with both of their sides. */
function oldPane(document: DiffDocument): DiffLineRow[] {
    return diffSplit(document).aligned.flatMap((entry) => (entry.kind === 'line' && entry.old !== undefined ? [entry.row] : []));
}

function lineOf(rows: readonly DiffLineRow[], change: DiffLineRow['change'], text: number): number {
    return rows.findIndex((row) => row.change === change && (row.new ?? row.old)!.number === text);
}

test('a context or added line opens on its own line of the new file with the caret in the same column', () => {
    const document = snapshots();
    const rows = diffDisplay(document).rows;

    expect(sourceLineOf(rows, document.hunks, lineOf(rows, 'context', 2), 2, 'new')).toEqual({ line: 2, column: 3 });
    expect(sourceLineOf(rows, document.hunks, lineOf(rows, 'insert', 3), 1, 'new')).toEqual({ line: 3, column: 2 });
});

test('a removed line opens on the line that took its place, or on the line before it at the end of the file', () => {
    const document = snapshots();
    const rows = diffDisplay(document).rows;

    expect(sourceLineOf(rows, document.hunks, lineOf(rows, 'delete', 3), 2, 'new')).toEqual({ line: 3, column: 1 });
    expect(sourceLineOf(rows, document.hunks, lineOf(rows, 'delete', 5), 0, 'new')).toEqual({ line: 5, column: 1 });

    const end = patch('@@ -1,2 +1,1 @@\n keep\n-last\n');

    expect(sourceLineOf(diffDisplay(end).rows, end.hunks, 1, 0, 'new')).toEqual({ line: 1, column: 1 });
});

test('a hunk that only removes keeps its place in the new file and never reaches into a later hunk', () => {
    const alone = patch('@@ -10,1 +9,0 @@\n-removed\n');
    const followed = patch('@@ -10,1 +9,0 @@\n-removed\n@@ -100,1 +99,1 @@\n-was\n+is\n');

    expect(sourceLineOf(diffDisplay(alone).rows, alone.hunks, 0, 0, 'new')).toEqual({ line: 9, column: 1 });
    expect(sourceLineOf(diffDisplay(followed).rows, followed.hunks, 0, 0, 'new')).toEqual({ line: 10, column: 1 });
    expect(sourceLineOf(oldPane(followed), followed.hunks, 0, 0, 'old')).toEqual({ line: 10, column: 1 });
});

test('the old pane of a split diff opens a changed line on the new line beside it, at its start', () => {
    const document = snapshots();
    const rows = oldPane(document);
    const fresh = diffSplit(document).new.rows;

    expect(
        sourceLineOf(
            rows,
            document.hunks,
            rows.findIndex((row) => row.change === 'pair'),
            2,
            'old'
        )
    ).toEqual({ line: 3, column: 1 });
    expect(sourceLineOf(rows, document.hunks, 0, 3, 'old')).toEqual({ line: 2, column: 4 });
    expect(
        sourceLineOf(
            fresh,
            document.hunks,
            fresh.findIndex((row) => row.change === 'pair'),
            2,
            'new'
        )
    ).toEqual({ line: 3, column: 3 });
});

test('a diff that deletes the file, or a caret past the rows, has no line to open', () => {
    const deleted = patch('@@ -1,2 +0,0 @@\n-one\n-two\n');

    expect(sourceLineOf(diffDisplay(deleted).rows, deleted.hunks, 0, 0, 'new')).toBeNull();
    expect(sourceLineOf(diffDisplay(snapshots()).rows, snapshots().hunks, 99, 0, 'new')).toBeNull();
});
