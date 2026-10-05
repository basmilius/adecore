import type { Engine } from '../protocol/index.ts';
import { splitStatements, tokenize } from '../sql-split.ts';

export type DestructiveKind = 'drop' | 'truncate' | 'delete' | 'update' | 'alterDrop';

/* A statement that takes data or structure away with no way back, and why it counts. */
export interface DestructiveStatement {
    readonly sql: string;
    readonly kind: DestructiveKind;
}

interface Word {
    readonly word: string;
    /* How many parentheses are open at the word. */
    readonly depth: number;
}

const wordsOf = (sql: string, engine: Engine): Word[] => {
    const words: Word[] = [];
    let depth = 0;
    for (const token of tokenize(sql, engine)) {
        const text = sql.slice(token.start, token.end);
        if (token.kind === 'word') {
            words.push({ word: text.toUpperCase(), depth });
        } else if (token.kind === 'punct' && text === '(') {
            depth += 1;
        } else if (token.kind === 'punct' && text === ')') {
            depth = Math.max(0, depth - 1);
        }
    }
    return words;
};

const kindOf = (sql: string, engine: Engine): DestructiveKind | null => {
    const words = wordsOf(sql, engine);
    const first = words[0]?.word;
    if (first === 'DROP') {
        return 'drop';
    }
    if (first === 'TRUNCATE') {
        return 'truncate';
    }
    if (first === 'ALTER') {
        return words.some(({ word }) => word === 'DROP') ? 'alterDrop' : null;
    }
    // A statement behind a `WITH` is the first DELETE or UPDATE outside any parentheses.
    const writer = first === 'WITH' ? words.find(({ word, depth }) => depth === 0 && (word === 'DELETE' || word === 'UPDATE')) : words[0];
    if (writer?.word !== 'DELETE' && writer?.word !== 'UPDATE') {
        return null;
    }
    const filtered = words.some(({ word, depth }) => word === 'WHERE' && depth === 0);
    return filtered ? null : writer.word === 'DELETE' ? 'delete' : 'update';
};

/* The statements of a script that drop, truncate, or delete or update without a `WHERE`. */
export const findDestructive = (sql: string, engine: Engine): DestructiveStatement[] =>
    splitStatements(sql, engine).flatMap((statement) => {
        const kind = kindOf(statement.text, engine);
        return kind === null ? [] : [{ sql: statement.text, kind }];
    });
