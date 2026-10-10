/* One text change: the range replaced, what replaces it, and where the selection lands in the new text. */
export interface TextEdit {
    readonly from: number;
    readonly to: number;
    readonly insert: string;
    readonly selectionStart: number;
    readonly selectionEnd: number;
}

export const INDENT = '    ';

export const applyEdit = (value: string, edit: TextEdit): string => value.slice(0, edit.from) + edit.insert + value.slice(edit.to);

const lineStartOf = (value: string, at: number): number => value.lastIndexOf('\n', at - 1) + 1;

const lineEndOf = (value: string, at: number): number => {
    const newline = value.indexOf('\n', at);
    return newline === -1 ? value.length : newline;
};

const indentOf = (line: string): string => /^[ \t]*/.exec(line)![0];

/* The lines a selection touches. A selection that ends at the start of a line leaves that line out. */
const touchedLines = (value: string, start: number, end: number): { from: number; to: number } => {
    const from = lineStartOf(value, start);
    const last = end > start && value[end - 1] === '\n' ? end - 1 : end;
    return { from, to: lineEndOf(value, last) };
};

/* Tab: four spaces at the caret, or one indent level on every touched line when the selection spans lines. */
export const indentEdit = (value: string, start: number, end: number): TextEdit => {
    if (!value.slice(start, end).includes('\n')) {
        return { from: start, to: end, insert: INDENT, selectionStart: start + INDENT.length, selectionEnd: start + INDENT.length };
    }
    const { from, to } = touchedLines(value, start, end);
    const lines = value.slice(from, to).split('\n');
    return {
        from,
        to,
        insert: lines.map((line) => (line === '' ? line : INDENT + line)).join('\n'),
        selectionStart: start + (lines[0] === '' ? 0 : INDENT.length),
        selectionEnd: end + lines.filter((line) => line !== '').length * INDENT.length
    };
};

/* Shift+Tab: takes one level of indentation off every touched line, four spaces or one tab. */
export const outdentEdit = (value: string, start: number, end: number): TextEdit | null => {
    const { from, to } = touchedLines(value, start, end);
    const lines = value.slice(from, to).split('\n');
    const removed = lines.map((line) => {
        if (line.startsWith('\t')) {
            return 1;
        }
        return Math.min(INDENT.length, /^ */.exec(line)![0].length);
    });
    const total = removed.reduce((sum, count) => sum + count, 0);
    if (total === 0) {
        return null;
    }
    return {
        from,
        to,
        insert: lines.map((line, index) => line.slice(removed[index]!)).join('\n'),
        selectionStart: Math.max(from, start - removed[0]!),
        selectionEnd: Math.max(from, end - total)
    };
};

/* Enter: a new line that starts with the indentation of the line the caret is on, up to the caret. */
export const newlineEdit = (value: string, start: number, end: number): TextEdit => {
    const lineStart = lineStartOf(value, start);
    const indent = indentOf(value.slice(lineStart, start));
    const insert = `\n${indent}`;
    return { from: start, to: end, insert, selectionStart: start + insert.length, selectionEnd: start + insert.length };
};
