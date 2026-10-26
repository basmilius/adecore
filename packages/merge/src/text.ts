/*
 * The shape of the file every line is put back into: what ends a line here, and whether the last one
 * is ended at all. A resolution that loses either rewrites the whole file on the next diff.
 */
export interface TextShape {
    eol: '\n' | '\r\n';
    finalNewline: boolean;
}

/* The line ending a file uses, by the first one in it, and whether it ends on one. */
export function shapeOf(text: string): TextShape {
    const line = text.indexOf('\n');

    return {
        eol: line > 0 && text[line - 1] === '\r' ? '\r\n' : '\n',
        finalNewline: text === '' || text.endsWith('\n')
    };
}

/* The lines of a file, without the empty one a trailing newline would leave behind. */
export function splitLines(text: string): string[] {
    if (text === '') {
        return [];
    }

    const lines = text.split(/\r\n|\n/);

    if (lines[lines.length - 1] === '') {
        lines.pop();
    }

    return lines;
}

/* The lines of a file split on `\n` alone, so a `\r` stays part of its line. */
export function rawLines(text: string): string[] {
    if (text === '') {
        return [];
    }

    const lines = text.split('\n');

    if (text.endsWith('\n')) {
        lines.pop();
    }

    return lines;
}

/* Git's --ignore-all-space may show either side's spacing, so a shown line matches by its non-space characters. */
export function lineMatcher(ignoreWhitespace: boolean): (shown: string, actual: string | undefined) => boolean {
    return ignoreWhitespace
        ? (shown, actual) => actual !== undefined && shown.replace(/\s+/g, '') === actual.replace(/\s+/g, '')
        : (shown, actual) => shown === actual;
}

export function joinLines(lines: readonly string[], shape: TextShape): string {
    return lines.length === 0 ? '' : lines.join(shape.eol) + (shape.finalNewline ? shape.eol : '');
}
