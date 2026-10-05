import type { Engine } from './protocol/index.ts';

/* One piece of SQL text. Whitespace is no token; every other character is part of one. */
export interface SqlToken {
    readonly kind: 'word' | 'quoted' | 'comment' | 'punct' | 'semicolon';
    /* Offsets into the text, `end` exclusive. */
    readonly start: number;
    readonly end: number;
}

/* A statement of a script, trimmed. `start` and `end` are offsets into the script, `end` exclusive and before the semicolon. */
export interface SqlStatement {
    readonly text: string;
    readonly start: number;
    readonly end: number;
}

const WHITESPACE = /\s/;

const isWordCode = (code: number): boolean =>
    (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || code === 36 || code >= 128;

const lineEnd = (text: string, at: number): number => {
    const newline = text.indexOf('\n', at);
    return newline === -1 ? text.length : newline + 1;
};

/* MySQL wants whitespace after the dashes; SQLite does not. */
const startsLineComment = (text: string, at: number, engine: Engine): boolean => {
    if (text[at] === '-' && text[at + 1] === '-') {
        if (engine === 'sqlite') {
            return true;
        }
        const next = text[at + 2];
        return next === undefined || WHITESPACE.test(next) || next.charCodeAt(0) < 32;
    }
    return text[at] === '#' && engine === 'mysql';
};

/* The index after the closing quote, or the end of the text for one that never closes. */
const quotedEnd = (text: string, at: number, engine: Engine): number => {
    const quote = text[at]!;
    const backslashEscapes = engine === 'mysql' && quote !== '`';
    let i = at + 1;
    while (i < text.length) {
        if (backslashEscapes && text[i] === '\\') {
            i += 2;
        } else if (text[i] === quote) {
            if (text[i + 1] === quote) {
                i += 2;
            } else {
                return i + 1;
            }
        } else {
            i += 1;
        }
    }
    return text.length;
};

/* Reads SQL the way the helper's splitter does: quotes, comments and escapes decide what a semicolon is. */
export const tokenize = (text: string, engine: Engine): SqlToken[] => {
    const tokens: SqlToken[] = [];
    let i = 0;
    while (i < text.length) {
        const char = text[i]!;
        const code = text.charCodeAt(i);
        if (WHITESPACE.test(char)) {
            i += 1;
        } else if (char === "'" || char === '"' || char === '`') {
            const end = quotedEnd(text, i, engine);
            tokens.push({ kind: 'quoted', start: i, end });
            i = end;
        } else if (char === '[' && engine === 'sqlite') {
            const close = text.indexOf(']', i);
            const end = close === -1 ? text.length : close + 1;
            tokens.push({ kind: 'quoted', start: i, end });
            i = end;
        } else if (startsLineComment(text, i, engine)) {
            const end = lineEnd(text, i);
            tokens.push({ kind: 'comment', start: i, end });
            i = end;
        } else if (char === '/' && text[i + 1] === '*') {
            const close = text.indexOf('*/', i + 2);
            const end = close === -1 ? text.length : close + 2;
            tokens.push({ kind: 'comment', start: i, end });
            i = end;
        } else if (char === ';') {
            tokens.push({ kind: 'semicolon', start: i, end: i + 1 });
            i += 1;
        } else if (isWordCode(code)) {
            let end = i + 1;
            while (end < text.length && isWordCode(text.charCodeAt(end))) {
                end += 1;
            }
            tokens.push({ kind: 'word', start: i, end });
            i = end;
        } else {
            tokens.push({ kind: 'punct', start: i, end: i + 1 });
            i += 1;
        }
    }
    return tokens;
};

/* Follows `CREATE TRIGGER ... BEGIN ... END` so the semicolons inside its body do not end the statement. */
class TriggerState {
    private readonly leading: string[] = [];
    private inBody = false;
    private caseDepth = 0;
    private closed = false;

    word(word: string): void {
        const upper = word.toUpperCase();
        if (this.leading.length < 3) {
            this.leading.push(upper);
        }
        if (!this.isTrigger()) {
            return;
        }
        if (upper === 'BEGIN' && !this.inBody) {
            this.inBody = true;
        } else if (upper === 'CASE' && this.inBody) {
            this.caseDepth += 1;
        } else if (upper === 'END' && this.inBody) {
            if (this.caseDepth > 0) {
                this.caseDepth -= 1;
            } else {
                this.closed = true;
            }
        }
    }

    splitsHere(): boolean {
        return !this.isTrigger() || !this.inBody || this.closed;
    }

    private isTrigger(): boolean {
        const [first, second, third] = this.leading;
        return first === 'CREATE' && (second === 'TRIGGER' || ((second === 'TEMP' || second === 'TEMPORARY') && third === 'TRIGGER'));
    }
}

const trimmed = (text: string, from: number, to: number): SqlStatement => {
    let start = from;
    let end = to;
    while (start < end && WHITESPACE.test(text[start]!)) {
        start += 1;
    }
    while (end > start && WHITESPACE.test(text[end - 1]!)) {
        end -= 1;
    }
    return { text: text.slice(start, end), start, end };
};

/*
 * Splits a script at the semicolons outside strings, quoted names and comments, with the rules of the
 * helper's splitter (`helper/src/splitter.rs`). A statement of nothing but comments is dropped, and
 * MySQL's client-side `DELIMITER` command is not understood.
 */
export const splitStatements = (text: string, engine: Engine): SqlStatement[] => {
    const statements: SqlStatement[] = [];
    let start = 0;
    let hasContent = false;
    let trigger = new TriggerState();

    for (const token of tokenize(text, engine)) {
        if (token.kind === 'semicolon') {
            if (trigger.splitsHere()) {
                if (hasContent) {
                    statements.push(trimmed(text, start, token.start));
                }
                start = token.end;
                hasContent = false;
                trigger = new TriggerState();
            }
        } else if (token.kind !== 'comment') {
            hasContent = true;
            if (token.kind === 'word' && engine === 'sqlite') {
                trigger.word(text.slice(token.start, token.end));
            }
        }
    }

    if (hasContent) {
        statements.push(trimmed(text, start, text.length));
    }
    return statements;
};

/*
 * The statement the caret belongs to. A caret in the gap after a statement belongs to it while it
 * stays on that line (so right after the semicolon is still that statement), and to the next one
 * from the next line on. `null` when the text holds no statement.
 */
export const statementAt = (text: string, offset: number, engine: Engine): SqlStatement | null => {
    const statements = splitStatements(text, engine);
    for (const [index, statement] of statements.entries()) {
        if (offset >= statement.start && offset <= statement.end) {
            return statement;
        }
        const next = statements[index + 1];
        if (offset > statement.end && (next === undefined || offset < next.start)) {
            const gap = text.slice(statement.end, offset);
            return gap.includes('\n') && next !== undefined ? next : statement;
        }
    }
    return statements[0] ?? null;
};

/* The first word of a statement in upper case, after comments and opening parentheses. */
export const firstKeyword = (text: string, engine: Engine): string => {
    for (const token of tokenize(text, engine)) {
        if (token.kind === 'comment' || (token.kind === 'punct' && text[token.start] === '(')) {
            continue;
        }
        return token.kind === 'word' ? (/^[A-Za-z]*/.exec(text.slice(token.start, token.end))?.[0] ?? '').toUpperCase() : '';
    }
    return '';
};
