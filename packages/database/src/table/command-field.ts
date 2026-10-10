import type { Engine, ValueKind } from '../protocol/index.ts';
import {
    equalsCondition,
    findColumn,
    notEqualsCondition,
    orderByClause,
    parseOrderByLoose,
    quoteIdentifier,
    sqlLiteral,
    type ColumnSort,
    type LiteralValue,
    type SortDirection
} from '../sql.ts';

/* A condition of the WHERE: `text` is what the chip shows and what editing it starts from, `sql` what goes to the server. */
export interface FilterChip {
    readonly kind: 'filter';
    readonly text: string;
    readonly sql: string;
}

export interface SortChip {
    readonly kind: 'sort';
    readonly column: string;
    readonly direction: SortDirection;
}

/* An ORDER BY that is more than a list of columns, such as one with `NULLS LAST`, kept as it was written. */
export interface OrderChip {
    readonly kind: 'order';
    readonly text: string;
}

export type Chip = FilterChip | SortChip | OrderChip;

export type StoredFilter = Pick<FilterChip, 'text' | 'sql'>;

export interface CommandColumn {
    readonly name: string;
    readonly type: string;
}

export type Suggestion =
    | { readonly kind: 'condition'; readonly chip: FilterChip }
    | { readonly kind: 'filter' | 'sort' | 'jump'; readonly column: CommandColumn }
    | { readonly kind: 'sql'; readonly chip: FilterChip };

/* How many columns the suggestions list for what is typed. */
export const SUGGESTED_COLUMNS = 4;

const OR = /\bor\b/i;
const BARE_NAME = /^[A-Za-z_][\w$]*$/;
const WORD = /^(`(?:[^`]|``)+`|"(?:[^"]|"")+"|[A-Za-z_][\w$]*)\s*([\s\S]*)$/;
const COMPARE = /^(==|=|<>|!=|<=|>=|<|>)\s*([\s\S]+)$/;
const PATTERN = /^((?:NOT\s+)?(?:LIKE|ILIKE|GLOB|REGEXP|RLIKE))\s+([\s\S]+)$/i;
const MEMBER = /^((?:NOT\s+)?IN)\s*(\([\s\S]+\))$/i;
const BETWEEN = /^((?:NOT\s+)?BETWEEN)\s+([\s\S]+?)\s+AND\s+([\s\S]+)$/i;
const IS_TEST = /^IS\s+(?:NOT\s+)?(?:NULL|TRUE|FALSE)$/i;
/* A name being typed, or one that opened a quote. Whitespace after it means an operator is coming. */
const NAME_BEING_TYPED = /^\s*(?:[\w$]*|[`"][^`"]*[`"]?)$/;

export const chipKey = (chip: Chip): string => (chip.kind === 'sort' ? `sort:${chip.column}` : `${chip.kind}:${chip.kind === 'filter' ? chip.sql : chip.text}`);

const isFilter = (chip: Chip): chip is FilterChip => chip.kind === 'filter';

const isSort = (chip: Chip): chip is SortChip => chip.kind === 'sort';

const sortChip = (sort: ColumnSort): SortChip => ({ kind: 'sort', column: sort.column, direction: sort.direction });

/* A name as typed in SQL: bare when it can be, else in double quotes. The quotes are only for the text of a chip; `sql` quotes per engine. */
export const identifierText = (name: string): string => (BARE_NAME.test(name) ? name : `"${name.replaceAll('"', '""')}"`);

/* The conditions AND-ed together, each in parentheses when it holds an OR and there is more than one. */
export const chipsToWhere = (chips: readonly Chip[]): string => {
    const conditions = chips
        .filter(isFilter)
        .map((chip) => chip.sql.trim())
        .filter((sql) => sql !== '');
    if (conditions.length < 2) {
        return conditions[0] ?? '';
    }
    return conditions.map((sql) => (OR.test(sql) ? `(${sql})` : sql)).join(' AND ');
};

/* The sort chips in order, each quoted for the engine; a raw ORDER BY keeps its place among them. */
export const chipsToOrderBy = (engine: Engine, chips: readonly Chip[]): string =>
    chips
        .flatMap((chip) => {
            if (chip.kind === 'sort') {
                return [orderByClause(engine, [chip])];
            }
            return chip.kind === 'order' ? [chip.text.trim()] : [];
        })
        .filter((part) => part !== '')
        .join(', ');

export const sortsOf = (chips: readonly Chip[]): ColumnSort[] => chips.filter(isSort).map(({ column, direction }) => ({ column, direction }));

/* The sorts of a header menu replace every sort and raw ORDER BY, keeping the filters where they are. */
export const withSorts = (chips: readonly Chip[], sorts: readonly ColumnSort[]): Chip[] => [...chips.filter(isFilter), ...sorts.map(sortChip)];

/* A column that is not sorted joins as ascending; one that is flips its direction where it stands. */
export const toggleSort = (chips: readonly Chip[], column: string): Chip[] => {
    if (!chips.some((chip) => isSort(chip) && chip.column === column)) {
        return [...chips, { kind: 'sort', column, direction: 'asc' }];
    }
    return chips.map((chip) => (isSort(chip) && chip.column === column ? { ...chip, direction: chip.direction === 'asc' ? 'desc' : 'asc' } : chip));
};

/* The same list when the chip is already in it. */
export const addChip = (chips: readonly Chip[], chip: Chip): Chip[] =>
    chips.some((other) => chipKey(other) === chipKey(chip)) ? [...chips] : [...chips, chip];

export const removeChipAt = (chips: readonly Chip[], index: number): Chip[] => chips.filter((_, at) => at !== index);

/* Puts the chip where another stood, dropping it if an equal one is already elsewhere in the list. */
export const replaceChipAt = (chips: readonly Chip[], index: number, chip: Chip): Chip[] => {
    const duplicate = chips.some((other, at) => at !== index && chipKey(other) === chipKey(chip));
    return duplicate ? removeChipAt(chips, index) : chips.map((other, at) => (at === index ? chip : other));
};

const rawFilter = (text: string): FilterChip => ({ kind: 'filter', text, sql: text });

/* The WHERE of a layout or of a jump as chips: the remembered ones when they still say that text, else the text as one raw chip. */
export const filterChipsOf = (where: string, remembered: readonly StoredFilter[] = []): Chip[] => {
    const text = where.trim();
    if (text === '') {
        return [];
    }
    const kept = remembered.map((filter): FilterChip => ({ kind: 'filter', text: filter.text, sql: filter.sql }));
    return chipsToWhere(kept) === text ? kept : [rawFilter(text)];
};

/* A plain list of columns becomes sort chips; anything else is one chip that keeps the text. */
export const sortChipsOf = (engine: Engine, orderBy: string): Chip[] => {
    const text = orderBy.trim();
    if (text === '') {
        return [];
    }
    const sorts = parseOrderByLoose(engine, text);
    return sorts === null ? [{ kind: 'order', text }] : sorts.map(sortChip);
};

export interface ChipSource {
    readonly where: string;
    readonly orderBy: string;
    readonly remembered?: readonly StoredFilter[];
}

export const chipsFromQuery = (engine: Engine, { where, orderBy, remembered }: ChipSource): Chip[] => [
    ...filterChipsOf(where, remembered),
    ...sortChipsOf(engine, orderBy)
];

/* Whether quotes and parentheses close, outside of which an operand would swallow the rest of the text. */
const isClosed = (operand: string): boolean => {
    let quote: string | null = null;
    let depth = 0;
    for (const character of operand) {
        if (quote !== null) {
            quote = character === quote ? null : quote;
        } else if (character === "'" || character === '"' || character === '`') {
            quote = character;
        } else if (character === '(') {
            depth++;
        } else if (character === ')') {
            depth--;
            if (depth < 0) {
                return false;
            }
        }
    }
    return quote === null && depth === 0;
};

const upper = (keyword: string): string => keyword.replace(/\s+/g, ' ').toUpperCase();

/* The operator and operands of a condition in the form the chip shows, or `null` when the text does not read as one. */
const readOperation = (rest: string): string | null => {
    const compare = COMPARE.exec(rest);
    if (compare !== null) {
        const operator = compare[1] === '==' ? '=' : compare[1] === '!=' ? '<>' : compare[1];
        return isClosed(compare[2]!) ? `${operator} ${compare[2]}` : null;
    }
    for (const form of [PATTERN, MEMBER]) {
        const found = form.exec(rest);
        if (found !== null) {
            return isClosed(found[2]!) ? `${upper(found[1]!)} ${found[2]}` : null;
        }
    }
    const between = BETWEEN.exec(rest);
    if (between !== null) {
        return isClosed(between[2]!) && isClosed(between[3]!) ? `${upper(between[1]!)} ${between[2]} AND ${between[3]}` : null;
    }
    return IS_TEST.test(rest) ? upper(rest) : null;
};

/*
 * The chip a typed text makes when it already reads as a condition: a column of the table, an
 * operator and what it needs after it. A text that is anything else stays for the person to finish or to hand over as SQL.
 */
export const parseCondition = (engine: Engine, text: string, columns: readonly string[]): FilterChip | null => {
    const match = WORD.exec(text.trim());
    if (match === null) {
        return null;
    }
    const column = findColumn(engine, match[1]!, columns);
    const operation = column === undefined ? null : readOperation(match[2]!.trim());
    if (column === undefined || operation === null) {
        return null;
    }
    return { kind: 'filter', text: `${match[1]} ${operation}`, sql: `${quoteIdentifier(engine, column)} ${operation}` };
};

/* `column = value` or `column <> value` for the cell a menu was opened on; NULL reads as IS NULL and IS NOT NULL. */
export const cellChip = (engine: Engine, column: string, value: LiteralValue, kind: ValueKind | undefined, exclude: boolean): FilterChip => {
    const name = identifierText(column);
    const text = value === null ? `${name} IS ${exclude ? 'NOT ' : ''}NULL` : `${name} ${exclude ? '<>' : '='} ${sqlLiteral(engine, value, kind)}`;
    return { kind: 'filter', text, sql: exclude ? notEqualsCondition(engine, column, value, kind) : equalsCondition(engine, column, value, kind) };
};

/* Cuts a long text for a label, ending in an ellipsis. */
export const shorten = (text: string, limit: number): string => (text.length > limit ? `${text.slice(0, limit - 1)}…` : text);

/* How well a name matches what is typed: 0 is the name itself, then its start, a word of it, anywhere in it; `null` is no match. */
const rankOf = (name: string, token: string): number | null => {
    const lower = name.toLowerCase();
    if (lower === token) {
        return 0;
    }
    if (lower.startsWith(token)) {
        return 1;
    }
    if (lower.split(/[\s_.-]+/).some((word) => word.startsWith(token))) {
        return 2;
    }
    return lower.includes(token) ? 3 : null;
};

/* The columns that match a typed name, the closest first and in table order among equals. */
export const matchColumns = (columns: readonly CommandColumn[], typed: string, limit = SUGGESTED_COLUMNS): CommandColumn[] => {
    const token = typed.trim().replace(/^[`"]/, '').replace(/[`"]$/, '').toLowerCase();
    if (token === '') {
        return [];
    }
    return columns
        .map((column, order) => ({ column, order, rank: rankOf(column.name, token) }))
        .filter((entry): entry is { column: CommandColumn; order: number; rank: number } => entry.rank !== null)
        .sort((left, right) => left.rank - right.rank || left.order - right.order)
        .slice(0, limit)
        .map((entry) => entry.column);
};

/*
 * What the popup under the field offers for the text: the condition it already is, then for each
 * matching column to filter, sort or jump to it, and last the text as plain SQL. Empty text offers nothing.
 */
export const suggest = (engine: Engine, text: string, columns: readonly CommandColumn[], limit = SUGGESTED_COLUMNS): Suggestion[] => {
    const typed = text.trim();
    if (typed === '') {
        return [];
    }
    const suggestions: Suggestion[] = [];
    const condition = parseCondition(
        engine,
        typed,
        columns.map((column) => column.name)
    );
    if (condition !== null) {
        suggestions.push({ kind: 'condition', chip: condition });
    }
    if (NAME_BEING_TYPED.test(text)) {
        for (const column of matchColumns(columns, typed, limit)) {
            suggestions.push({ kind: 'filter', column }, { kind: 'sort', column }, { kind: 'jump', column });
        }
    }
    suggestions.push({ kind: 'sql', chip: rawFilter(typed) });
    return suggestions;
};

/* What the input holds after "Filter on <column>" is picked, ready for an operator and a value. */
export const filterStartText = (column: CommandColumn): string => `${identifierText(column.name)} `;
