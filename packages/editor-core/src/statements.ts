import type { EditSource } from './edit-source.ts';
import { lineContinues } from './enter.ts';
import { isBlank, whitespaceOf } from './line-text.ts';

/* The indentation of a line text in columns, tabs taken to their stops. */
export function indentWidth(text: string, tabSize: number): number {
    return visualWidth(whitespaceOf(text), tabSize);
}

/* The width in columns of a text that starts a line, tabs taken to their stops. */
export function visualWidth(text: string, tabSize: number): number {
    let width = 0;

    for (const character of text) {
        width += character === '\t' ? tabSize - (width % tabSize) : 1;
    }

    return width;
}

/* The `{` brackets the offset is inside, innermost first. None in a string, a comment or markup, and an `${` of a template is no block. */
export function enclosingBraces(source: EditSource, offset: number): number[] {
    const context = source.context(offset);

    if (context.mode !== 'code') {
        return [];
    }

    const braces: number[] = [];

    for (let bracket = context.bracket; bracket !== undefined; bracket = bracket.previous) {
        if (bracket.close === '}' && bracket.template !== true) {
            braces.push(bracket.at);
        }
    }

    return braces;
}

/* The innermost `{` around the offset, or null. */
export function enclosingBrace(source: EditSource, offset: number): number | null {
    return enclosingBraces(source, offset)[0] ?? null;
}

export interface IndentGuide {
    /* The line the guide starts on: the header, at the guide's own indent. */
    startLine: number;
    /* The first later line at or above the guide's indent, or the line count when the text ends first. */
    endLine: number;
}

function nextNonBlank(source: EditSource, line: number): number {
    let next = line + 1;

    while (next < source.lineCount && isBlank(source.line(next).text)) {
        next++;
    }

    return next;
}

/*
 * The guide an editor draws at `column` (in columns, tabs expanded) that holds `line`: a line at that indent
 * whose next non-blank line is deeper starts it, and the first later non-blank line at or above that indent ends it.
 */
export function indentGuideAt(source: EditSource, line: number, column: number, tabSize: number): IndentGuide | null {
    if (column <= 0 || line < 0 || line >= source.lineCount) {
        return null;
    }

    for (let start = line; start >= 0; start--) {
        const text = source.line(start).text;

        if (isBlank(text)) {
            continue;
        }

        const indent = indentWidth(text, tabSize);

        if (indent > column) {
            continue;
        }

        const following = nextNonBlank(source, start);

        if (indent < column || following >= source.lineCount || indentWidth(source.line(following).text, tabSize) <= column) {
            return null;
        }

        let end = following;

        while (end < source.lineCount && (isBlank(source.line(end).text) || indentWidth(source.line(end).text, tabSize) > column)) {
            end++;
        }

        return end > line ? { startLine: start, endLine: end } : null;
    }

    return null;
}

const CONTINUATION_START = /^(?:\.|\?\.|&&|\|\||\?\?|\+(?!\+)|-(?!-)|\?|:|else\b|catch\b|finally\b)/;

/*
 * The first line of the statement a line belongs to: a line that opens with a closer belongs to the statement of its
 * opener, and a line the one above leaves open, or that goes on with a member access, an operator or `else`, to the one above.
 */
export function statementStart(source: EditSource, line: number, language: string): number {
    let first = line;

    // Each step goes up at least one line, so the walk ends.
    while (first > 0) {
        const info = source.line(first);
        const lead = info.text.length - info.text.trimStart().length;
        const opener = /^[)\]}]/.test(info.text.slice(lead)) ? source.context(info.start + lead).bracket : undefined;
        const openerLine = opener === undefined ? first : source.lineAt(opener.at);

        if (openerLine < first) {
            first = openerLine;

            continue;
        }

        const above = first - 1;

        if (isBlank(source.line(above).text) || !(CONTINUATION_START.test(info.text.trimStart()) || lineContinues(source, language, above))) {
            break;
        }

        first = above;
    }

    return first;
}
