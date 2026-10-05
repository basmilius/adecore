import type { Cell, Engine, Value, ValueKind } from './protocol/index.ts';

export type SortDirection = 'asc' | 'desc';

export interface ColumnSort {
    readonly column: string;
    readonly direction: SortDirection;
}

/* The table a statement written for a copy or a filter points at. */
export interface SqlTarget {
    readonly engine: Engine;
    readonly table: string;
    readonly schema?: string;
}

/* What a literal can be made of: a cell as a result holds it, a whole value, or the column's default. */
export type LiteralValue = Cell | Value | { readonly kind: 'default' };

const NUMERIC_KINDS: ReadonlySet<ValueKind> = new Set(['integer', 'decimal', 'float']);
const NUMERIC_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const ORDER_ITEM = /\s*(`(?:[^`]|``)+`|"(?:[^"]|"")+"|[A-Za-z_][\w$]*)(?:\s+(asc|desc))?\s*(,|$)/iy;

const markOf = (engine: Engine): string => (engine === 'mysql' ? '`' : '"');

export const quoteIdentifier = (engine: Engine, name: string): string => {
    const mark = markOf(engine);
    return `${mark}${name.replaceAll(mark, mark + mark)}${mark}`;
};

/* `schema.table` with both parts quoted, or the table alone. */
export const qualifiedName = (target: SqlTarget): string =>
    target.schema === undefined || target.schema === ''
        ? quoteIdentifier(target.engine, target.table)
        : `${quoteIdentifier(target.engine, target.schema)}.${quoteIdentifier(target.engine, target.table)}`;

const stringLiteral = (engine: Engine, text: string): string => {
    // MySQL reads a backslash as an escape unless the server runs with NO_BACKSLASH_ESCAPES.
    const escaped = engine === 'mysql' ? text.replaceAll('\\', '\\\\') : text;
    return `'${escaped.replaceAll("'", "''")}'`;
};

const binaryLiteral = (engine: Engine, hex: string): string => (engine === 'mysql' && hex !== '' ? `0x${hex}` : `X'${hex}'`);

/* A value as SQL source. `kind` lets a number that arrived as text (a decimal, a big integer) stay a number. */
export const sqlLiteral = (engine: Engine, value: LiteralValue, kind?: ValueKind): string => {
    if (value === null) {
        return 'NULL';
    }
    switch (typeof value) {
        case 'boolean':
            return engine === 'mysql' ? (value ? 'TRUE' : 'FALSE') : value ? '1' : '0';
        case 'number':
            return Number.isFinite(value) ? String(value) : 'NULL';
        case 'string': {
            const trimmed = value.trim();
            return kind !== undefined && NUMERIC_KINDS.has(kind) && NUMERIC_TEXT.test(trimmed) ? trimmed : stringLiteral(engine, value);
        }
    }
    switch (value.kind) {
        case 'default':
            return 'DEFAULT';
        case 'binary':
            return binaryLiteral(engine, value.hex);
        case 'longText':
            return stringLiteral(engine, value.preview);
    }
};

/* `col = literal`, or `col IS NULL` since `= NULL` never matches. */
export const equalsCondition = (engine: Engine, column: string, value: LiteralValue, kind?: ValueKind): string =>
    value === null ? `${quoteIdentifier(engine, column)} IS NULL` : `${quoteIdentifier(engine, column)} = ${sqlLiteral(engine, value, kind)}`;

export interface ColumnMatch {
    readonly column: string;
    readonly value: LiteralValue;
    readonly kind?: ValueKind;
}

/* `a = 1 AND b IS NULL` for the columns of a key; the text a WHERE field holds. */
export const matchCondition = (engine: Engine, matches: readonly ColumnMatch[]): string =>
    matches.map((match) => equalsCondition(engine, match.column, match.value, match.kind)).join(' AND ');

/* The text after `ORDER BY`: every column quoted, every direction spelled out. */
export const orderByClause = (engine: Engine, sorts: readonly ColumnSort[]): string =>
    sorts.map((sort) => `${quoteIdentifier(engine, sort.column)} ${sort.direction === 'asc' ? 'ASC' : 'DESC'}`).join(', ');

const unquote = (engine: Engine, word: string): string | null => {
    const mark = word[0]!;
    if (mark !== '`' && mark !== '"') {
        return word;
    }
    // A double quoted word is a string in MySQL, which sorts by a constant and so is not a column.
    if (mark === '"' && engine === 'mysql') {
        return null;
    }
    return word.slice(1, -1).replaceAll(mark + mark, mark);
};

/*
 * The sorts an ORDER BY text says, or `null` when it is anything but a plain list of the given
 * columns, each with an optional direction. Empty text is an empty list. A column is found without
 * regard to case, since both engines treat names that way.
 */
export const parseOrderBy = (engine: Engine, text: string, columns: readonly string[]): ColumnSort[] | null => {
    const source = text.trim();
    if (source === '') {
        return [];
    }
    const sorts: ColumnSort[] = [];
    let position = 0;
    while (position < source.length) {
        ORDER_ITEM.lastIndex = position;
        const match = ORDER_ITEM.exec(source);
        if (match === null) {
            return null;
        }
        const word = unquote(engine, match[1]!);
        const column = word === null ? undefined : (columns.find((name) => name === word) ?? columns.find((name) => name.toLowerCase() === word.toLowerCase()));
        if (column === undefined || sorts.some((sort) => sort.column === column)) {
            return null;
        }
        sorts.push({ column, direction: match[2]?.toLowerCase() === 'desc' ? 'desc' : 'asc' });
        position = ORDER_ITEM.lastIndex;
        if (match[3] === '') {
            return sorts;
        }
        if (position >= source.length) {
            return null;
        }
    }
    return sorts;
};

/* Adds a condition to what a WHERE field holds. An `OR` in it is wrapped, so the new condition narrows the whole. */
export const andWhere = (existing: string, condition: string): string => {
    const current = existing.trim();
    if (current === '') {
        return condition;
    }
    return `${/\bor\b/i.test(current) ? `(${current})` : current} AND ${condition}`;
};
