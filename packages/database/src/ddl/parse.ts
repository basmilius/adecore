import type { TableStructure } from '../protocol/index.ts';

const CLOSERS: Readonly<Record<string, string>> = { "'": "'", '"': '"', '`': '`', '[': ']' };

interface Spot {
    readonly index: number;
    readonly char: string;
    /* The number of parentheses open around it; a parenthesis counts for the level it sits in. */
    readonly depth: number;
}

/* The characters of SQL that are not inside a quote, for a scan that has to ignore a comma in a default or a comment. */
function* unquoted(text: string, backslash: boolean): Generator<Spot> {
    let depth = 0;
    let closer: string | null = null;
    for (let i = 0; i < text.length; i++) {
        const char = text[i]!;
        if (closer !== null) {
            if (backslash && char === '\\' && closer === "'") {
                i++;
            } else if (char === closer) {
                if (closer !== ']' && text[i + 1] === closer) {
                    i++;
                } else {
                    closer = null;
                }
            }
            continue;
        }
        if (char in CLOSERS) {
            closer = CLOSERS[char]!;
            continue;
        }
        if (char === ')') {
            depth--;
        }
        yield { index: i, char, depth };
        if (char === '(') {
            depth++;
        }
    }
}

export interface Definition {
    /* The column and constraint definitions, each as written. */
    readonly items: readonly string[];
    /* What follows the closing parenthesis: the table options. */
    readonly tail: string;
}

/* Splits a `CREATE TABLE` into its definitions and its table options, or `null` when it holds no parenthesis. */
export const definitionOf = (ddl: string | null): Definition | null => {
    if (ddl === null) {
        return null;
    }
    // Only a MySQL statement reads a backslash as an escape, and only a MySQL statement quotes with backticks.
    const backslash = ddl.includes('`');
    let open = -1;
    let close = -1;
    const commas: number[] = [];
    for (const { index, char, depth } of unquoted(ddl, backslash)) {
        if (open < 0) {
            if (char === '(' && depth === 0) {
                open = index;
            }
        } else if (close < 0) {
            if (char === ')' && depth === 0) {
                close = index;
            } else if (char === ',' && depth === 1) {
                commas.push(index);
            }
        }
    }
    if (open < 0 || close < 0) {
        return null;
    }
    const bounds = [open, ...commas, close];
    return {
        items: bounds.slice(1).map((end, at) => ddl.slice(bounds[at]! + 1, end).trim()),
        tail: ddl.slice(close + 1)
    };
};

/* The name a definition starts with, unquoted. */
const leadingName = (item: string): string | null => {
    const mark = item[0];
    if (mark === '`' || mark === '"') {
        const end = item.indexOf(mark, 1);
        return end < 0 ? null : item.slice(1, end).replaceAll(mark + mark, mark);
    }
    if (mark === '[') {
        const end = item.indexOf(']');
        return end < 0 ? null : item.slice(1, end);
    }
    return /^[^\s(]+/.exec(item)?.[0] ?? null;
};

const AS_OPEN = /\b(?:GENERATED\s+ALWAYS\s+)?AS\s*\(/i;
const AS_SUFFIX = /^\s*(?:VIRTUAL|STORED|PERSISTENT)\b/i;

/* The `GENERATED ALWAYS AS (...) STORED` clause of a column definition, or `null` when it has none. */
const generatedClauseOf = (item: string): string | null => {
    // A default or a comment may hold the words, so the strings are blanked before the search.
    const masked = item.replace(/'(?:[^']|'')*'/g, (text) => ' '.repeat(text.length));
    const start = AS_OPEN.exec(masked);
    if (start === null) {
        return null;
    }
    const open = start.index + start[0].length - 1;
    let end = -1;
    for (const { index, char, depth } of unquoted(masked.slice(open), false)) {
        if (char === ')' && depth === 0) {
            end = open + index + 1;
            break;
        }
    }
    if (end < 0) {
        return null;
    }
    const suffix = AS_SUFFIX.exec(masked.slice(end));
    return item.slice(start.index, end + (suffix?.[0].length ?? 0)).trim();
};

/* The generated clause of every generated column in a table's DDL, by column name. */
export const generatedClausesOf = (ddl: string | null): ReadonlyMap<string, string> => {
    const clauses = new Map<string, string>();
    for (const item of definitionOf(ddl)?.items ?? []) {
        const name = leadingName(item);
        const clause = name === null ? null : generatedClauseOf(item);
        if (name !== null && clause !== null) {
            clauses.set(name, clause);
        }
    }
    return clauses;
};

/* What the options of a table say, in the terms of both engines; the ones an engine has no word for stay empty. */
export interface TableOptions {
    readonly engine: string;
    readonly charset: string;
    readonly collation: string;
    readonly comment: string;
    readonly withoutRowid: boolean;
    readonly strict: boolean;
}

export const NO_OPTIONS: TableOptions = { engine: '', charset: '', collation: '', comment: '', withoutRowid: false, strict: false };

export const optionsOf = (structure: Pick<TableStructure, 'ddl'>): TableOptions => {
    const tail = definitionOf(structure.ddl)?.tail ?? '';
    const word = (pattern: RegExp): string => pattern.exec(tail)?.[1] ?? '';
    const comment = /\bCOMMENT\s*=?\s*'((?:[^'\\]|''|\\.)*)'/i.exec(tail)?.[1] ?? '';
    return {
        engine: word(/\bENGINE\s*=\s*(\w+)/i),
        charset: word(/\b(?:DEFAULT\s+)?(?:CHARSET|CHARACTER\s+SET)\s*=?\s*(\w+)/i),
        collation: word(/\bCOLLATE\s*=?\s*(\w+)/i),
        comment: comment.replaceAll("''", "'").replace(/\\(.)/g, '$1'),
        withoutRowid: /\bWITHOUT\s+ROWID\b/i.test(tail),
        strict: /\bSTRICT\b/i.test(tail)
    };
};
