import type { EditorContentChange, EditorPosition, EditorRange } from '@adecore/editor';

export function comparePositions(left: EditorPosition, right: EditorPosition): number {
    return left.line === right.line ? left.character - right.character : left.line - right.line;
}

export function sameRange(left: EditorRange, right: EditorRange): boolean {
    return comparePositions(left.start, right.start) === 0 && comparePositions(left.end, right.end) === 0;
}

/* Where an insertion of `text` at `start` ends, counting a line break of any kind once. */
export function endOfInsertion(start: EditorPosition, text: string): EditorPosition {
    const lines = text.split(/\r\n|\r|\n/);

    return lines.length === 1
        ? { line: start.line, character: start.character + text.length }
        : { line: start.line + lines.length - 1, character: lines[lines.length - 1]!.length };
}

/* Where a position is once one change is applied to the text it was in. One inside the replaced range lands after the new text. */
export function shiftPosition(position: EditorPosition, change: EditorContentChange): EditorPosition {
    const { start, end } = change.range;

    if (comparePositions(position, start) < 0) {
        return position;
    }

    const inserted = endOfInsertion(start, change.text);

    if (comparePositions(position, end) < 0) {
        return inserted;
    }

    return position.line === end.line
        ? { line: inserted.line, character: inserted.character + (position.character - end.character) }
        : { line: position.line + (inserted.line - end.line), character: position.character };
}

export function shiftRange(range: EditorRange, changes: readonly EditorContentChange[]): EditorRange {
    let start = range.start;
    let end = range.end;

    for (const change of changes) {
        start = shiftPosition(start, change);
        end = shiftPosition(end, change);
    }

    return { start, end };
}

/* A range holds a position from its start up to and including its end, so a caret at either edge of a word is on it. An empty range holds only its own place. */
export function rangeHolds(range: EditorRange, position: EditorPosition): boolean {
    return comparePositions(range.start, position) <= 0 && comparePositions(position, range.end) <= 0;
}
