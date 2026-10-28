import type { OffsetRange } from './document.ts';
import type { EditSource } from './edit-source.ts';
import { isPhp, isScript, isWordCharacter } from './lexical.ts';
import { whitespaceOf } from './line-text.ts';
import { enclosingBraces } from './statements.ts';
import { placeAt } from './text-places.ts';
import { skipTriviaBack } from './trivia.ts';
import type { TextEdit } from './types.ts';

export type UnwrapKind = 'if' | 'else' | 'removeElse' | 'for' | 'while' | 'do' | 'try' | 'removeCatch' | 'removeFinally' | 'braces';

export interface UnwrapTarget {
    readonly kind: UnwrapKind;
    /* The whole construct, for the preview. */
    readonly range: OffsetRange;
    /* Small edits, so the selections map through them. */
    readonly edits: readonly TextEdit[];
}

type HeaderWord = 'if' | 'else' | 'for' | 'while' | 'do' | 'try' | 'catch' | 'finally' | 'braces';

/* What opens a block: its keyword, and for an `if` that follows an `else`, where that `else` starts. */
interface Header {
    readonly word: HeaderWord;
    readonly start: number;
    readonly elseStart?: number;
}

interface Block {
    readonly header: Header;
    readonly open: number;
    readonly close: number;
}

const SCAN_LIMIT = 2_000_000;
const LOOPS = new Set(['for', 'foreach']);

function wordBefore(source: EditSource, end: number): { text: string; from: number } | null {
    const to = skipTriviaBack(source, end);
    let from = to;

    while (from > 0 && isWordCharacter(source.charAt(from - 1))) {
        from--;
    }

    return from === to ? null : { text: source.slice(from, to), from };
}

function skipSpaces(source: EditSource, at: number): number {
    let next = at;

    while (/\s/u.test(source.charAt(next))) {
        next++;
    }

    return next;
}

function wordAt(source: EditSource, at: number): string {
    let end = at;

    while (end < at + 12 && isWordCharacter(source.charAt(end))) {
        end++;
    }

    return source.slice(at, end);
}

/* The closer of the bracket at `open`. */
function closerOf(source: EditSource, open: number): number | null {
    const closer = source.charAt(open) === '(' ? ')' : '}';
    const text = source.slice(open + 1, Math.min(source.line(source.lineCount - 1).end, open + 1 + SCAN_LIMIT));

    for (let index = text.indexOf(closer); index >= 0; index = text.indexOf(closer, index + 1)) {
        const context = source.context(open + 1 + index);

        if (context.mode === 'code' && context.bracket?.at === open) {
            return open + 1 + index;
        }
    }

    return null;
}

/* The header of the block that opens at `open`, or null for a function, a class, an object and the like. */
function headerOf(source: EditSource, open: number): Header | null {
    const before = skipTriviaBack(source, open);
    const last = source.charAt(before - 1);

    if (last === ')') {
        const paren = source.context(before - 1).bracket;
        // The lexer flags the parenthesis of `foreach` and `elseif` as plain, so the word decides.
        const keyword = paren === undefined ? null : wordBefore(source, paren.at);

        if (keyword === null) {
            return null;
        }

        if (LOOPS.has(keyword.text) || keyword.text === 'await') {
            const loop = keyword.text === 'await' ? wordBefore(source, keyword.from) : keyword;

            return loop !== null && LOOPS.has(loop.text) ? { word: 'for', start: loop.from } : null;
        }

        if (keyword.text === 'elseif') {
            return { word: 'if', start: keyword.from, elseStart: keyword.from };
        }

        if (keyword.text === 'if') {
            const before = wordBefore(source, keyword.from);

            return { word: 'if', start: keyword.from, elseStart: before?.text === 'else' ? before.from : undefined };
        }

        if (keyword.text === 'while') {
            return { word: 'while', start: keyword.from };
        }

        return keyword.text === 'catch' ? { word: 'catch', start: keyword.from } : null;
    }

    const word = wordBefore(source, open);

    if (word !== null) {
        return word.text === 'else' || word.text === 'try' || word.text === 'finally' || word.text === 'do' || word.text === 'catch'
            ? { word: word.text, start: word.from }
            : null;
    }

    // The lexer takes a brace after `;` or `{` for an object, so only the text before it says that it is a block.
    const inBlock = last === ';' || last === '{' || before === 0 || (last === '}' && source.context(before - 1).bracket?.block === true);

    return inBlock ? { word: 'braces', start: open } : null;
}

/* The block that ends right before `end`, past whitespace and comments. */
function blockEndingAt(source: EditSource, end: number): Block | null {
    const close = skipTriviaBack(source, end) - 1;
    const open = close >= 0 && source.charAt(close) === '}' ? source.context(close).bracket : undefined;

    if (open === undefined || open.template === true) {
        return null;
    }

    const header = headerOf(source, open.at);

    return header === null ? null : { header, open: open.at, close };
}

/* The closer of the block after an optional parenthesis, starting at `at`. */
function blockAfter(source: EditSource, at: number, parenthesis: boolean): number | null {
    let next = skipSpaces(source, at);

    if (parenthesis) {
        const close = source.charAt(next) === '(' ? closerOf(source, next) : null;

        if (close === null) {
            return null;
        }

        next = skipSpaces(source, close + 1);
    }

    return source.charAt(next) === '{' ? closerOf(source, next) : null;
}

/* The end of an `if` statement whose first block closes at `close`, past its `else if` and `else` clauses. */
function ifEnd(source: EditSource, close: number): number {
    let end = close + 1;

    for (;;) {
        const at = skipSpaces(source, end);
        const word = wordAt(source, at);
        let next: number | null = null;

        if (word === 'elseif') {
            next = blockAfter(source, at + word.length, true);
        } else if (word === 'else') {
            const after = skipSpaces(source, at + word.length);

            next = wordAt(source, after) === 'if' ? blockAfter(source, after + 2, true) : blockAfter(source, at + word.length, false);
        }

        if (next === null) {
            return end;
        }

        end = next + 1;
    }
}

interface Clause {
    readonly word: 'try' | 'catch' | 'finally';
    readonly close: number;
}

/* The `try` block that closes at `close` and the `catch` and `finally` blocks behind it. */
function tryClauses(source: EditSource, close: number): Clause[] {
    const clauses: Clause[] = [{ word: 'try', close }];

    for (;;) {
        const at = skipSpaces(source, clauses.at(-1)!.close + 1);
        const word = wordAt(source, at);

        if (word !== 'catch' && word !== 'finally') {
            return clauses;
        }

        const closer = blockAfter(source, at + word.length, source.charAt(skipSpaces(source, at + word.length)) === '(');

        if (closer === null) {
            return clauses;
        }

        clauses.push({ word, close: closer });
    }
}

/* The end of a `do` statement whose block closes at `close`, with its `while` condition. */
function doEnd(source: EditSource, close: number): number {
    const at = skipSpaces(source, close + 1);

    if (wordAt(source, at) !== 'while') {
        return close + 1;
    }

    const paren = skipSpaces(source, at + 5);
    const closer = source.charAt(paren) === '(' ? closerOf(source, paren) : null;

    if (closer === null) {
        return close + 1;
    }

    return closer + 1 + (/^[ \t]*;/.exec(source.slice(closer + 1, closer + 16))?.[0].length ?? 0);
}

function lineBreakLength(source: EditSource, at: number): number {
    const char = source.charAt(at);

    if (char === '\r') {
        return source.charAt(at + 1) === '\n' ? 2 : 1;
    }

    return char === '\n' ? 1 : 0;
}

/* The construct and the line it leaves blank, as one deletion. */
function deleteConstruct(source: EditSource, start: number, end: number): TextEdit {
    const first = source.line(source.lineAt(start));
    const last = source.line(source.lineAt(end));

    return {
        from: source.slice(first.start, start).trim() === '' ? first.start : start,
        to: source.slice(end, last.end).trim() === '' ? last.next : end,
        text: ''
    };
}

/* The edits that keep the body of the block at `open` and drop the rest of the construct that runs from `start` to `end`. */
function unwrapEdits(source: EditSource, indentUnit: string, start: number, open: number, close: number, end: number): TextEdit[] {
    if (source.slice(open + 1, close).trim() === '') {
        return [deleteConstruct(source, start, end)];
    }

    let afterOpen = open + 1;

    while (source.charAt(afterOpen) === ' ' || source.charAt(afterOpen) === '\t') {
        afterOpen++;
    }

    const headerLine = source.line(source.lineAt(start));
    const headerIndent = whitespaceOf(headerLine.text).length;
    // The body takes the place of the header, so the header's own indentation goes too.
    const edits: TextEdit[] = [
        { from: source.slice(headerLine.start, start).trim() === '' ? headerLine.start : start, to: afterOpen + lineBreakLength(source, afterOpen), text: '' }
    ];
    let delta = 0;

    for (let index = source.lineAt(open) + 1; index < source.lineAt(close); index++) {
        const line = source.line(index);

        if (line.text.trim() === '') {
            continue;
        }

        const indent = whitespaceOf(line.text).length;

        if (delta === 0) {
            delta = indent > headerIndent ? indent - headerIndent : indentUnit.length;
        }

        const removed = Math.min(delta, indent);

        if (removed > 0) {
            edits.push({ from: line.start, to: line.start + removed, text: '' });
        }
    }

    const closing = source.line(source.lineAt(close));
    const alone = source.slice(closing.start, close).trim() === '';
    let from = close;

    if (alone && closing.start > 0) {
        from = source.line(source.lineAt(close) - 1).end;
    } else {
        while (from > closing.start && /[ \t]/.test(source.charAt(from - 1))) {
            from--;
        }
    }

    edits.push({ from, to: end, text: '' });

    return edits;
}

/* The `if` statement an `else` block belongs to, and the block right before the `else`. */
function ifOf(source: EditSource, header: Header): { start: number; previous: Block } | null {
    let current = header;
    let first: Block | null = null;

    for (;;) {
        const previous = blockEndingAt(source, current.elseStart ?? current.start);

        if (previous === null || previous.header.word !== 'if') {
            return null;
        }

        first ??= previous;

        if (previous.header.elseStart === undefined) {
            return { start: previous.header.start, previous: first };
        }

        current = previous.header;
    }
}

/* The `try` block and its clauses around a `catch` or `finally` block. */
function tryOf(source: EditSource, header: Header): { start: number; clauses: Clause[] } | null {
    let current = header;

    for (;;) {
        const previous = blockEndingAt(source, current.start);

        if (previous === null || (previous.header.word !== 'try' && previous.header.word !== 'catch')) {
            return null;
        }

        if (previous.header.word === 'try') {
            return { start: previous.header.start, clauses: tryClauses(source, previous.close) };
        }

        current = previous.header;
    }
}

function targetsOf(source: EditSource, header: Header, open: number, indentUnit: string): UnwrapTarget[] {
    const close = closerOf(source, open);

    if (close === null) {
        return [];
    }

    switch (header.word) {
        case 'if': {
            const end = ifEnd(source, close);

            return [{ kind: 'if', range: { from: header.start, to: end }, edits: unwrapEdits(source, indentUnit, header.start, open, close, end) }];
        }

        case 'else': {
            const chain = ifOf(source, header);

            if (chain === null) {
                return [];
            }

            const range = { from: chain.start, to: close + 1 };

            return [
                { kind: 'else', range, edits: unwrapEdits(source, indentUnit, chain.start, open, close, close + 1) },
                { kind: 'removeElse', range, edits: [{ from: chain.previous.close + 1, to: close + 1, text: '' }] }
            ];
        }

        case 'for':
        case 'while':
            return [
                {
                    kind: header.word,
                    range: { from: header.start, to: close + 1 },
                    edits: unwrapEdits(source, indentUnit, header.start, open, close, close + 1)
                }
            ];

        case 'do': {
            const end = doEnd(source, close);

            return [{ kind: 'do', range: { from: header.start, to: end }, edits: unwrapEdits(source, indentUnit, header.start, open, close, end) }];
        }

        case 'try': {
            const end = tryClauses(source, close).at(-1)!.close + 1;

            return [{ kind: 'try', range: { from: header.start, to: end }, edits: unwrapEdits(source, indentUnit, header.start, open, close, end) }];
        }

        case 'catch':
        case 'finally': {
            const statement = tryOf(source, header);
            const index = statement?.clauses.findIndex((clause) => clause.close === close) ?? -1;

            if (statement === null || index < 1) {
                return [];
            }

            const others = statement.clauses.filter((clause, position) => position !== index && clause.word !== 'try');

            // A try needs a catch or a finally, so the last of them stays, and a finally needs a catch beside it.
            if (header.word === 'catch' ? others.length === 0 : !others.some((clause) => clause.word === 'catch')) {
                return [];
            }

            return [
                {
                    kind: header.word === 'catch' ? 'removeCatch' : 'removeFinally',
                    range: { from: statement.start, to: statement.clauses.at(-1)!.close + 1 },
                    edits: [{ from: statement.clauses[index - 1]!.close + 1, to: close + 1, text: '' }]
                }
            ];
        }

        default:
            return [{ kind: 'braces', range: { from: open, to: close + 1 }, edits: unwrapEdits(source, indentUnit, open, open, close, close + 1) }];
    }
}

/*
 * What can be unwrapped or removed around an offset, innermost first: a statement whose body stays and whose header goes,
 * or a clause that goes with its body. Only the blocks of control statements and bare blocks count, not functions, classes or objects.
 */
export function unwrapTargets(source: EditSource, offset: number, language: string, indentUnit: string): UnwrapTarget[] {
    const place = placeAt(source, offset, language);

    if (place.kind !== 'code' || !(isScript(place.language) || isPhp(place.language))) {
        return [];
    }

    const targets: UnwrapTarget[] = [];

    for (const open of enclosingBraces(source, offset)) {
        const header = headerOf(source, open);

        if (header !== null) {
            targets.push(...targetsOf(source, header, open, indentUnit));
        }
    }

    return targets;
}
