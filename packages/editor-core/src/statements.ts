import type { EditSource } from './edit-source.ts';
import { lineContinues } from './enter.ts';
import type { FoldingRange } from './structure.ts';
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

const CONTINUATION_START = /^(?:\{|\.|\?\.|&&|\|\||\?\?|\+(?!\+)|-(?!-)|\?|:|else\b|catch\b|finally\b)/;

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

const MODIFIERS =
    '(?:export\\s+|default\\s+|declare\\s+|abstract\\s+|async\\s+|pub(?:\\([^)]*\\))?\\s+|public\\s+|private\\s+|protected\\s+|static\\s+|final\\s+|readonly\\s+|override\\s+|unsafe\\s+|extern\\s+)*';

// The outline of the editor reads headers the same way; a statement is not a declaration when it ends in a value, so `type` and `namespace` are left out.
export const DECLARATION = new RegExp(`^${MODIFIERS}(function\\*?|class|interface|enum|trait|impl|struct|fn|func|object|record)\\b`);
export const METHOD = /^(?:(?:public|private|protected|static|async|get|set|override|readonly|abstract)\s+)*\*?\s*([A-Za-z_$#][\w$]*)\s*[(<]/;
export const NOT_METHODS = new Set([
    'if',
    'for',
    'while',
    'switch',
    'catch',
    'function',
    'return',
    'else',
    'with',
    'do',
    'try',
    'new',
    'await',
    'typeof',
    'super',
    'finally'
]);
export const BODIES = new Set(['class', 'interface', 'enum', 'trait', 'impl', 'struct', 'object', 'record']);
/* What kind of body the offset is in: that of an interface, of another type or namespace, or none of them. */
export function declarationBody(source: EditSource, offset: number): 'interface' | 'other' | null {
    const brace = enclosingBrace(source, offset);

    if (brace === null) {
        return null;
    }

    const braceLine = source.lineAt(brace);
    const own = source.line(braceLine).text.slice(0, brace - source.line(braceLine).start);
    // A brace on a line of its own belongs to the header above it.
    const header = own.trim() === '' && braceLine > 0 ? source.line(braceLine - 1).text : own;

    if (/\binterface\b/.test(header)) {
        return 'interface';
    }

    return /\b(?:class|enum|trait|impl|struct|object|record|namespace)\b/.test(header) ? 'other' : null;
}

export interface StatementRange {
    /* The first line, counting the doc comment and the attributes above the code. */
    first: number;
    /* The first line of the code itself. */
    code: number;
    last: number;
}

/* The doc comment a line is part of, as the lines it spans. */
function docCommentAt(source: EditSource, line: number): { first: number; last: number } | null {
    let first = line;

    while (first >= 0 && !source.line(first).text.trim().startsWith('/**') && source.line(first).text.trim().startsWith('*')) {
        first--;
    }

    if (first < 0 || !source.line(first).text.trim().startsWith('/**')) {
        return null;
    }

    let last = first;

    while (last < source.lineCount - 1 && !source.line(last).text.includes('*/')) {
        last++;
    }

    return last >= line ? { first, last } : null;
}

function isAttribute(text: string): boolean {
    return /^\s*(?:@|#\[)/.test(text);
}

const NO_STRUCTURE: readonly FoldingRange[] = [];

/* The offset of the bracket that is still open at the start of a line and is no block of statements. */
function enclosingOpener(source: EditSource, line: number): number | null {
    const open = source.context(source.line(line).start).bracket;

    return open !== undefined && open.template !== true && !(open.close === '}' && open.block === true) ? open.at : null;
}

function chainLength(source: EditSource, offset: number): number {
    let length = 0;

    for (let bracket = source.context(offset).bracket; bracket !== undefined; bracket = bracket.previous) {
        length++;
    }

    return length;
}

/* The last line of the statement that starts on `from`: where the brackets it opened are closed again and nothing goes on. */
function statementLast(source: EditSource, from: number, language: string): number {
    const depth = chainLength(source, source.line(from).start);
    const isDo = /^\s*do\b/.test(source.line(from).text);

    for (let line = from; line < source.lineCount; line++) {
        const info = source.line(line);

        if (chainLength(source, info.end) > depth || lineContinues(source, language, line)) {
            continue;
        }

        const next = line + 1 < source.lineCount ? source.line(line + 1).text.trimStart() : '';

        if (next !== '' && (CONTINUATION_START.test(next) || (isDo && /^while\b/.test(next))) && !isBlank(info.text)) {
            continue;
        }

        return line;
    }

    return source.lineCount - 1;
}

/*
 * The lines of the statement a line belongs to. A doc comment and the attributes right above it are part of it, a line
 * in them stands for the statement below, and a range a server or a bracket pair folds from its first line sets its end.
 */
export function statementAt(source: EditSource, line: number, language: string, structure: readonly FoldingRange[] = NO_STRUCTURE): StatementRange {
    let code = line;
    const doc = docCommentAt(source, code);

    if (doc !== null) {
        code = doc.last + 1;
    }

    while (code < source.lineCount - 1 && isAttribute(source.line(code).text)) {
        code++;
    }

    if (code >= source.lineCount || isBlank(source.line(code).text)) {
        return { first: line, code: line, last: line };
    }

    // A line inside brackets a line above opened belongs to the statement of that line.
    for (let open = enclosingOpener(source, code); open !== null; open = enclosingOpener(source, code)) {
        code = statementStart(source, source.lineAt(open), language);
    }

    code = statementStart(source, code, language);
    let first = code;

    for (let above = first - 1; above >= 0; above = first - 1) {
        const comment = source.line(above).text.trim().endsWith('*/') ? docCommentAt(source, above) : null;

        if (comment !== null) {
            first = comment.first;
        } else if (isAttribute(source.line(above).text)) {
            first = above;
        } else {
            break;
        }
    }

    let last = statementLast(source, code, language);

    for (const range of structure) {
        if (range.startLine === code && range.endLine > last) {
            last = range.endLine;
        }
    }

    return { first, code, last };
}
