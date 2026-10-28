import type { EditPlan, EditSource } from './edit-source.ts';
import { continues, planEnter } from './enter.ts';
import { isBraced, statementTerminator } from './lexical.ts';
import { whitespaceOf } from './line-text.ts';
import { BODIES, DECLARATION, declarationBody, METHOD, NOT_METHODS, statementStart } from './statements.ts';
import type { Selection } from './types.ts';

export interface CompleteStatementOptions {
    language: string;
    /* One level of indentation. */
    unit: string;
    tabSize: number;
}

/* A replacement of `[from, to)` and where the caret lands in its text. */
interface Piece {
    from: number;
    to: number;
    text: string;
    caret: number;
}

const CONTROL = /^(?:else\s+if|elseif|if|for|foreach|while|switch|catch|with)\b/;
const PYTHON_BLOCK = /^(?:async\s+)?(?:if|elif|else|for|while|def|class|try|except|finally|with|match|case)\b/;

function startNewLine(source: EditSource, line: number, options: CompleteStatementOptions): Piece {
    const end = source.line(line).end;

    return planEnter(source, end, end, { ...options, smart: true, reach: false });
}

/* The offset a statement on this line ends at: before a trailing comment and the whitespace in front of it. Null where the line is not code. */
function statementEnd(source: EditSource, line: number, caret: number): number | null {
    const info = source.line(line);

    if (/comment/.test(source.context(caret).mode)) {
        return null;
    }

    const atEnd = source.context(info.end);
    let end = info.end;

    if (atEnd.mode === 'line-comment' && atEnd.commentStart !== undefined) {
        end = atEnd.commentStart;
    }

    while (end > info.start && /\s/.test(source.charAt(end - 1))) {
        end--;
    }

    if (end === info.start) {
        return null;
    }

    const mode = source.context(end).mode;

    return mode === 'code' || mode === 'quote' ? end : null;
}

/* The parenthesis of a control statement closes at the end of the text: `if (a)`, and no body after it. */
function endsWithCondition(head: string): boolean {
    const open = head.indexOf('(');

    if (open < 0) {
        return false;
    }

    let depth = 0;

    for (let i = open; i < head.length; i++) {
        depth += head[i] === '(' ? 1 : head[i] === ')' ? -1 : 0;

        if (depth === 0) {
            return i === head.length - 1;
        }
    }

    return false;
}

function completeBraced(source: EditSource, lineIndex: number, caret: number, options: CompleteStatementOptions): Piece {
    const line = source.line(lineIndex);
    const end = statementEnd(source, lineIndex, caret);

    if (end === null || (source.region(lineIndex) ?? 'script') !== 'script') {
        return startNewLine(source, lineIndex, options);
    }

    const context = source.context(end);
    const first = statementStart(source, lineIndex, options.language);
    const firstStart = source.line(first).start;
    const startsWithBrace = /^\s*\}/.test(line.text) && source.context(line.start + whitespaceOf(line.text).length).bracket?.block !== false;
    let inline = context.mode === 'quote' ? (context.quote ?? '') : '';
    let open = context.bracket;

    let resume: number | null = null;

    for (; open !== undefined && open.template !== true && !(open.close === '}' && open.block === true) && open.at >= firstStart; open = open.previous) {
        const closer = source.closerOf(open.at);

        if (closer === undefined) {
            inline += open.close;
        } else {
            resume = closer;
        }
    }

    // A later line closes a bracket of this one, so the statement goes on there and ends there.
    if (resume !== null) {
        return completeBraced(source, source.lineAt(resume), resume, options);
    }

    const tail = source.slice(end, line.end);
    const newline = source.newline(lineIndex);
    const indent = whitespaceOf(startsWithBrace ? line.text : source.line(first).text);
    const body = indent + options.unit;
    const written = (startsWithBrace ? source.slice(line.start, end) : source.slice(firstStart, end)) + inline;
    const head = (startsWithBrace ? written.trim().slice(1) : written).trim();
    const nothing = (): Piece => startNewLine(source, lineIndex, options);

    const replaceTail = (text: string, caretAt: number): Piece => ({ from: end, to: line.end, text, caret: caretAt });

    // A block with its closer on a line of its own and the caret on the line between.
    const block = (opener: string, closer = '}'): Piece => {
        const opened = `${inline}${opener}${tail}${newline}${body}`;

        return replaceTail(`${opened}${newline}${indent}${closer}`, opened.length);
    };

    if (inline === '' && head.endsWith('{}') && source.context(end - 1).bracket?.block === true) {
        return { from: end - 1, to: line.end, text: `${newline}${body}${newline}${indent}}${tail}`, caret: newline.length + body.length };
    }

    if (inline === '' && head.endsWith('{')) {
        if (tail === '') {
            return startNewLine(source, lineIndex, options);
        }

        const opened = `${tail}${newline}${body}`;

        return replaceTail(source.unclosedBrace(end - 1) ? `${opened}${newline}${indent}}` : opened, opened.length);
    }

    const control = CONTROL.exec(head);
    const condition = control === null ? null : head.slice(control[0].length).trim();

    if (control !== null && condition === '') {
        return replaceTail(`${inline} () {${tail}${newline}${indent}}`, inline.length + 2);
    }

    if (control !== null && !(control[0] === 'while' && startsWithBrace) && condition!.startsWith('(') && endsWithCondition(condition!)) {
        return block(' {');
    }

    if (/^(?:else|try|finally|do)$/.test(head)) {
        return block(' {', head === 'do' ? '} while ();' : '}');
    }

    if ((/^case\b/.test(head) && head.length > 4 && !head.endsWith(':')) || head === 'default') {
        const text = `${inline}:${tail}${newline}${body}`;

        return replaceTail(text, text.length);
    }

    const declaring = declarationBody(source, end);
    const declaration = DECLARATION.exec(head)?.[1];
    const method = declaration === undefined && declaring === 'other' ? METHOD.exec(head)?.[1] : undefined;

    if (declaring !== 'interface' && (declaration !== undefined || (method !== undefined && !NOT_METHODS.has(method)))) {
        const bodiless = /^(?:\w+\s+)*?(?:abstract|declare)\s/.test(head) && !BODIES.has(declaration ?? '');

        if (!bodiless) {
            return block(' {');
        }
    }

    const terminator = statementTerminator(options.language);
    const last = head.at(-1);

    const closedBlock = inline === '' && last === '}' && source.context(end - 1).bracket?.block === true;
    const inExpression = open !== undefined && !(open.close === '}' && open.block === true);
    const goesOn = inline === '' && continues(source.slice(line.start, end), context, options.language);

    const ends = terminator !== null && head !== '' && !/^(?:@|#\[)/.test(head) && !';{,:'.includes(last!) && !closedBlock && !inExpression && !goesOn;

    const added = inline + (ends ? terminator : '');

    return added === '' ? nothing() : { from: end, to: end, text: added, caret: added.length };
}

function completePython(source: EditSource, lineIndex: number, caret: number, options: CompleteStatementOptions): Piece {
    const line = source.line(lineIndex);
    const end = statementEnd(source, lineIndex, caret);

    if (end === null || source.context(end).mode !== 'code') {
        return startNewLine(source, lineIndex, options);
    }

    let inline = '';
    let resume: number | null = null;

    for (let open = source.context(end).bracket; open !== undefined; open = open.previous) {
        const closer = source.closerOf(open.at);

        if (closer === undefined) {
            inline += open.close;
        } else {
            resume = closer;
        }
    }

    if (resume !== null) {
        return completePython(source, source.lineAt(resume), resume, options);
    }

    const head = (source.slice(line.start, end) + inline).trim();
    const tail = source.slice(end, line.end);

    if (PYTHON_BLOCK.test(head) && !head.endsWith(':')) {
        const text = `${inline}:${tail}${source.newline(lineIndex)}${whitespaceOf(line.text)}${options.unit}`;

        return { from: end, to: line.end, text, caret: text.length };
    }

    return inline === '' ? startNewLine(source, lineIndex, options) : { from: end, to: end, text: inline, caret: inline.length };
}

/* Where Complete Current Statement puts its edits for the carets. Every caret acts on its line, and carets on one line count once. */
export function planCompleteStatement(source: EditSource, selections: readonly Selection[], options: CompleteStatementOptions): EditPlan {
    const complete = isBraced(options.language) ? completeBraced : /^(python|py)$/i.test(options.language) ? completePython : null;
    const pieces = new Map<number, Piece>();
    const byStart = new Map<number, Piece>();

    for (const selection of selections) {
        const line = source.lineAt(selection.head);
        const piece = complete === null ? startNewLine(source, line, options) : complete(source, line, selection.head, options);

        // Carets on lines of one statement end up at the same edit, which applies once.
        pieces.set(line, byStart.get(piece.from) ?? piece);
        byStart.set(piece.from, pieces.get(line)!);
    }

    const ordered = [...new Set(pieces.values())].sort((left, right) => left.from - right.from);
    const carets = new Map<Piece, number>();
    let delta = 0;

    for (const piece of ordered) {
        carets.set(piece, piece.from + delta + piece.caret);
        delta += piece.text.length - (piece.to - piece.from);
    }

    return {
        edits: ordered.map((piece) => ({ from: piece.from, to: piece.to, text: piece.text })),
        selections: selections.map((selection) => {
            const caret = carets.get(pieces.get(source.lineAt(selection.head))!)!;

            return { anchor: caret, head: caret };
        })
    };
}
