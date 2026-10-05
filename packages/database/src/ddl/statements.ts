import { quote, sqliteSchemaPrefix, tableName, type Dialect } from './dialect.ts';

export const dropTableSql = (dialect: Dialect, schema: string, table: string): string => `DROP TABLE ${tableName(dialect, schema, table)}`;

export const dropViewSql = (dialect: Dialect, schema: string, view: string): string => `DROP VIEW ${tableName(dialect, schema, view)}`;

/* SQLite has no `TRUNCATE`; deleting every row is what it does instead. */
export const truncateTableSql = (dialect: Dialect, schema: string, table: string): string =>
    dialect.engine === 'sqlite' ? `DELETE FROM ${tableName(dialect, schema, table)}` : `TRUNCATE TABLE ${tableName(dialect, schema, table)}`;

export const renameTableSql = (dialect: Dialect, schema: string, from: string, to: string): string =>
    dialect.engine === 'sqlite'
        ? `ALTER TABLE ${tableName(dialect, schema, from)} RENAME TO ${quote(dialect, to)}`
        : `RENAME TABLE ${tableName(dialect, schema, from)} TO ${tableName(dialect, schema, to)}`;

/* MySQL drops an index from the table it is on; SQLite names it alone, in its schema. */
export const dropIndexSql = (dialect: Dialect, schema: string, table: string, index: string): string =>
    dialect.engine === 'sqlite'
        ? `DROP INDEX ${sqliteSchemaPrefix(dialect, schema)}${quote(dialect, index)}`
        : `DROP INDEX ${quote(dialect, index)} ON ${tableName(dialect, schema, table)}`;
