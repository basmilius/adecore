import type { EditSource } from './edit-source.ts';
import { lineContinues } from './enter.ts';
import { skipTriviaBack } from './trivia.ts';

export interface SurroundShape {
    /* The range after trimming whitespace. */
    readonly from: number;
    readonly to: number;
    /* Whole statements: statement surrounders apply. */
    readonly statements: boolean;
    /* One expression: `(expr)` and `!(expr)` apply. */
    readonly expression: boolean;
}

const KEYWORDS = new Set([
    'if',
    'else',
    'for',
    'foreach',
    'while',
    'do',
    'try',
    'catch',
    'finally',
    'switch',
    'case',
    'default',
    'return',
    'throw',
    'break',
    'continue',
    'const',
    'let',
    'var',
    'function',
    'class',
    'interface',
    'enum',
    'import',
    'export',
    'echo',
    'use',
    'namespace',
    'abstract',
    'final'
]);

/* Whether a statement can start at the offset: after `;`, a block, a control statement's head, `else` or `do`, or on a line the one above leaves closed. */
export function atStatementStart(source: EditSource, offset: number, language: string): boolean {
    const context = source.context(offset);
    const bracket = context.bracket;

    // Inside parentheses, brackets or an object literal a new line starts an element, not a statement.
    if (context.mode !== 'code' || (bracket !== undefined && !(bracket.close === '}' && bracket.block === true && bracket.template !== true))) {
        return false;
    }

    if (context.word === 'control-close' || context.word === 'else' || context.word === 'do') {
        return true;
    }

    const before = skipTriviaBack(source, offset);

    if (before === 0) {
        return true;
    }

    const last = source.charAt(before - 1);

    if (last === ';' || (last === '{' && bracket?.at === before - 1)) {
        return true;
    }

    if (last === '}') {
        const opener = source.context(before - 1).bracket;

        if (opener?.block === true && opener.template !== true) {
            return true;
        }
    }

    const line = source.line(source.lineAt(offset));

    return source.slice(line.start, offset).trim() === '' && (line.start === 0 || !lineContinues(source, language, source.lineAt(offset) - 1));
}

/* Whether a statement ends at the offset: after `;` or `}`, or at the end of a line the statement does not go on after. */
function atStatementEnd(source: EditSource, offset: number, language: string): boolean {
    const last = source.charAt(offset - 1);

    if (last === ';' || last === '}') {
        return true;
    }

    const index = source.lineAt(offset);

    return source.slice(offset, source.line(index).end).trim() === '' && !lineContinues(source, language, index);
}

/* Whether the range holds a `;` or a block at its own depth, which no expression does. */
function holdsStatements(source: EditSource, from: number, to: number): boolean {
    const bracket = source.context(from).bracket;

    for (const match of source.slice(from, to).matchAll(/[;{]/g)) {
        const at = from + match.index;

        if (source.context(at).bracket?.at !== bracket?.at || source.context(at).mode !== 'code') {
            continue;
        }

        if (match[0] === ';' || source.context(at + 1).bracket?.block === true) {
            return true;
        }
    }

    return false;
}

/* The line break of the range's last line, past a trailing line comment, or `to` when something else follows. */
function widenedEnd(source: EditSource, to: number): number {
    const line = source.line(source.lineAt(to));
    const rest = source.slice(to, line.end);

    if (rest.trim() === '') {
        return to;
    }

    const context = source.context(line.end);

    if (context.mode !== 'line-comment' || context.commentStart === undefined || context.commentStart < to) {
        return to;
    }

    return source.slice(to, context.commentStart).trim() === '' ? to + rest.trimEnd().length : to;
}

/*
 * What a range can be surrounded with: whole statements, one expression, both or neither. Both ends have to be code
 * in the same bracket, and statements also start and end where a statement does.
 */
export function surroundShape(source: EditSource, from: number, to: number, language: string): SurroundShape | null {
    let start = from;
    let end = to;

    while (start < end && /\s/u.test(source.charAt(start))) {
        start++;
    }

    while (end > start && /\s/u.test(source.charAt(end - 1))) {
        end--;
    }

    if (start >= end) {
        return null;
    }

    const first = source.context(start);
    const last = source.context(end);

    // Brackets are compared by position, since a scan makes new ones for the line it starts on.
    if (first.mode !== 'code' || last.mode !== 'code' || first.bracket?.at !== last.bracket?.at) {
        return { from: start, to: end, statements: false, expression: false };
    }

    const statements = atStatementStart(source, start, language) && atStatementEnd(source, end, language);
    const wide = statements ? widenedEnd(source, end) : end;
    const text = source.slice(start, end);
    const word = /^[\p{L}_$][\p{L}\p{N}_$]*/u.exec(text)?.[0] ?? '';
    const expression = wide === end && !/[\n\r]/.test(text) && !KEYWORDS.has(word) && !holdsStatements(source, start, end);

    return { from: start, to: wide, statements, expression };
}
