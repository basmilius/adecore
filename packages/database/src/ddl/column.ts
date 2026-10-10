import { sqlLiteral } from '../sql.ts';
import { quote, type Dialect } from './dialect.ts';
import type { ColumnDraft } from './draft.ts';

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const STRING = /^'(?:[^']|'')*'$/;
const KEYWORD = /^(?:NULL|TRUE|FALSE|CURRENT_DATE|CURRENT_TIME(?:\(\d*\))?|CURRENT_TIMESTAMP(?:\(\d*\))?|LOCALTIME(?:STAMP)?(?:\(\d*\))?|NOW\(\d*\))$/i;

/*
 * The text after `DEFAULT`. A literal and the few keywords both engines take stand as written; any
 * other expression goes in parentheses, which SQLite and MySQL 8 need for one that is not constant.
 */
export const defaultClause = (expression: string): string => {
    const text = expression.trim();
    if (NUMBER.test(text) || STRING.test(text) || KEYWORD.test(text)) {
        return text;
    }
    return text.startsWith('(') && text.endsWith(')') ? text : `(${text})`;
};

export interface ColumnSqlOptions {
    /* SQLite only: the column is the whole primary key, which an `AUTOINCREMENT` has to be declared on. */
    readonly inlinePrimaryKey?: boolean;
}

/* A column's definition without its name: `varchar(255) NOT NULL DEFAULT 'x'`. */
export const columnSpecSql = (dialect: Dialect, column: ColumnDraft, { inlinePrimaryKey = false }: ColumnSqlOptions = {}): string => {
    const mysql = dialect.engine === 'mysql';
    const parts: string[] = [];
    if (column.type !== '') {
        parts.push(column.type);
    }
    if (column.generated && column.generatedClause !== null) {
        parts.push(column.generatedClause);
    }
    if (inlinePrimaryKey) {
        parts.push(column.autoIncrement ? 'PRIMARY KEY AUTOINCREMENT' : 'PRIMARY KEY');
    }
    // MariaDB takes neither NULL nor NOT NULL after the expression of a computed column.
    const statesNullability = !(column.generated && dialect.flavor === 'mariadb');
    if (statesNullability && !column.nullable) {
        parts.push('NOT NULL');
    } else if (statesNullability && mysql) {
        // MySQL gives a TIMESTAMP column NOT NULL unless it is told otherwise.
        parts.push('NULL');
    }
    if (!column.generated) {
        if (column.defaultValue !== null && column.defaultValue.trim() !== '') {
            parts.push(`DEFAULT ${defaultClause(column.defaultValue)}`);
        }
        if (mysql && column.autoIncrement) {
            parts.push('AUTO_INCREMENT');
        }
    }
    if (mysql && column.comment !== '') {
        parts.push(`COMMENT ${sqlLiteral('mysql', column.comment)}`);
    }
    return parts.join(' ');
};

export const columnSql = (dialect: Dialect, column: ColumnDraft, options?: ColumnSqlOptions): string =>
    `${quote(dialect, column.name)} ${columnSpecSql(dialect, column, options)}`.trimEnd();

const typeKey = (type: string): string => type.toLowerCase().replace(/\s+/g, ' ').trim();

/* Whether two columns are defined alike, whatever their names. SQLite keeps no comments, so they never differ there. */
export const sameDefinition = (dialect: Dialect, left: ColumnDraft, right: ColumnDraft): boolean =>
    typeKey(left.type) === typeKey(right.type) &&
    left.nullable === right.nullable &&
    (left.defaultValue ?? '').trim() === (right.defaultValue ?? '').trim() &&
    left.autoIncrement === right.autoIncrement &&
    (dialect.engine === 'sqlite' || left.comment === right.comment) &&
    left.generatedClause === right.generatedClause;
