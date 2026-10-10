import type { ValueKind } from '../protocol/index.ts';
import { isNumericKind, qualifiedName, quoteIdentifier, sqlLiteral, type SqlTarget } from '../sql.ts';
import { copyTextOf, type Shown } from './display.ts';

export type CopyFormat = 'tsv' | 'csv' | 'json' | 'sql';

export const COPY_FORMATS: readonly CopyFormat[] = ['tsv', 'csv', 'json', 'sql'];

export interface CopyColumn {
    readonly name: string;
    readonly kind: ValueKind;
}

export interface CopyInput {
    readonly columns: readonly CopyColumn[];
    /* One array per row, one cell per column. A preview copies as the preview. */
    readonly rows: readonly (readonly Shown[])[];
    /* Needed for `sql`. */
    readonly target?: SqlTarget;
}

const JSON_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

const quoteField = (text: string): string => `"${text.replaceAll('"', '""')}"`;

/* Tabs and line breaks would split a cell on paste, so a cell that holds one is quoted the way a spreadsheet does. */
const tsvField = (text: string): string => (/[\t\r\n"]/.test(text) ? quoteField(text) : text);

const csvField = (text: string): string => (/[",\r\n]/.test(text) ? quoteField(text) : text);

const csvText = (cell: Shown): string => (cell === null ? '' : copyTextOf(cell));

const jsonOf = (cell: Shown, kind: ValueKind): string => {
    if (cell === null) {
        return 'null';
    }
    if (typeof cell === 'boolean') {
        return String(cell);
    }
    if (typeof cell === 'number') {
        if (kind === 'boolean' && (cell === 0 || cell === 1)) {
            return String(cell === 1);
        }
        return Number.isFinite(cell) ? String(cell) : 'null';
    }
    if (typeof cell === 'string') {
        if (isNumericKind(kind) && JSON_NUMBER.test(cell)) {
            return cell;
        }
        if (kind === 'json') {
            try {
                return JSON.stringify(JSON.parse(cell));
            } catch {
                return JSON.stringify(cell);
            }
        }
        return JSON.stringify(cell);
    }
    return cell.kind === 'default' ? 'null' : JSON.stringify(copyTextOf(cell));
};

const toTsv = ({ rows }: CopyInput): string => rows.map((row) => row.map((cell) => tsvField(copyTextOf(cell))).join('\t')).join('\n');

const toCsv = ({ columns, rows }: CopyInput): string =>
    [columns.map((column) => csvField(column.name)), ...rows.map((row) => row.map((cell) => csvField(csvText(cell))))]
        .map((line) => line.join(','))
        .join('\r\n');

const toJson = ({ columns, rows }: CopyInput): string => {
    if (rows.length === 0) {
        return '[]';
    }
    const objects = rows.map((row) => {
        if (columns.length === 0) {
            return '  {}';
        }
        const fields = columns.map((column, index) => `    ${JSON.stringify(column.name)}: ${jsonOf(row[index] ?? null, column.kind)}`);
        return `  {\n${fields.join(',\n')}\n  }`;
    });
    return `[\n${objects.join(',\n')}\n]`;
};

const toSql = ({ columns, rows, target }: CopyInput): string => {
    if (target === undefined) {
        throw new Error('Copying as SQL needs the table the rows belong to.');
    }
    const head = `INSERT INTO ${qualifiedName(target)} (${columns.map((column) => quoteIdentifier(target.engine, column.name)).join(', ')}) VALUES`;
    return rows.map((row) => `${head} (${columns.map((column, index) => sqlLiteral(target.engine, row[index] ?? null, column.kind)).join(', ')});`).join('\n');
};

/*
 * A block of cells as text. TSV is what a spreadsheet pastes and has no header; CSV follows RFC 4180
 * with a header and leaves NULL empty; JSON is an array of objects that keeps numbers, booleans and
 * NULL as what they are; SQL is one INSERT per row.
 */
export const formatCopy = (format: CopyFormat, input: CopyInput): string => {
    switch (format) {
        case 'tsv':
            return toTsv(input);
        case 'csv':
            return toCsv(input);
        case 'json':
            return toJson(input);
        case 'sql':
            return toSql(input);
    }
};
