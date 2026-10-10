import { columnSql, defaultClause } from './column.ts';
import { createIndexSql, createTableParts } from './create.ts';
import { atLeast, quote, tableName, type Dialect } from './dialect.ts';
import type { TableDiff } from './diff.ts';
import { isAutoIndex, type ColumnDraft, type TableDraft } from './draft.ts';
import { dropIndexSql } from './statements.ts';

const RENAME_COLUMN = [3, 25];
const DROP_COLUMN = [3, 35];

/* Whether `ALTER TABLE .. ADD COLUMN` takes the column; it refuses a key, a stored computed value, or a NOT NULL column with nothing to fill the rows with. */
const addable = (column: ColumnDraft): boolean => {
    if (column.autoIncrement || (column.generated && column.generatedClause !== null && /\bSTORED\b/i.test(column.generatedClause))) {
        return false;
    }
    const expression = column.defaultValue?.trim() ?? '';
    if (expression === '') {
        return column.nullable;
    }
    // Only a constant may fill existing rows: not an expression, not the clock.
    const clause = defaultClause(expression);
    return !clause.startsWith('(') && !/^CURRENT_|^LOCALTIME|^NOW/i.test(clause) && (column.nullable || !/^NULL$/i.test(clause));
};

const needsRebuild = (dialect: Dialect, original: TableDraft, diff: TableDiff): boolean => {
    if (diff.optionsChanged || diff.primaryKeyChanged || diff.droppedForeignKeys.length > 0 || diff.addedForeignKeys.length > 0) {
        return true;
    }
    if (diff.keptColumns.some((kept) => kept.redefined || kept.moved || (kept.renamed && !atLeast(dialect, ...RENAME_COLUMN)))) {
        return true;
    }
    if (diff.addedColumns.some((added) => added.placed || !addable(added.column))) {
        return true;
    }
    if (diff.droppedColumns.length > 0 && !atLeast(dialect, ...DROP_COLUMN)) {
        return true;
    }
    const autoIndexed = new Set(original.indexes.filter((index) => isAutoIndex(index.name)).flatMap((index) => index.columns));
    if (diff.droppedColumns.some((dropped) => autoIndexed.has(dropped.name))) {
        return true;
    }
    return [...diff.droppedIndexes, ...diff.renamedIndexes.map(({ from }) => from)].some((index) => isAutoIndex(index.name));
};

/* The steps of https://www.sqlite.org/lang_altertable.html under "Making Other Kinds Of Table Schema Changes", which keep the rows, the indexes and the foreign keys of other tables intact. */
const rebuildSql = (dialect: Dialect, schema: string, original: TableDraft, draft: TableDraft, diff: TableDiff): string[] => {
    const temporary = `new_${draft.name}`;
    const { table, indexes } = createTableParts(dialect, schema, draft, temporary);
    const copied = diff.keptColumns.filter((kept) => !kept.column.generated);
    const statements = ['PRAGMA foreign_keys=OFF', 'BEGIN', table];
    if (copied.length > 0) {
        const into = copied.map((kept) => quote(dialect, kept.column.name)).join(', ');
        const from = copied.map((kept) => quote(dialect, kept.original.name)).join(', ');
        statements.push(`INSERT INTO ${tableName(dialect, schema, temporary)} (${into}) SELECT ${from} FROM ${tableName(dialect, schema, original.name)}`);
    }
    statements.push(
        `DROP TABLE ${tableName(dialect, schema, original.name)}`,
        `ALTER TABLE ${tableName(dialect, schema, temporary)} RENAME TO ${quote(dialect, draft.name)}`,
        ...indexes.map((index) => createIndexSql(dialect, schema, draft.name, index)),
        'PRAGMA foreign_key_check',
        'COMMIT',
        'PRAGMA foreign_keys=ON'
    );
    return statements;
};

/* `ALTER TABLE` where SQLite has one, a rebuild of the table for every other change. */
export const sqliteAlterSql = (dialect: Dialect, schema: string, original: TableDraft, draft: TableDraft, diff: TableDiff): string[] => {
    if (needsRebuild(dialect, original, diff)) {
        return rebuildSql(dialect, schema, original, draft, diff);
    }
    const target = tableName(dialect, schema, original.name);
    const statements: string[] = [];
    for (const index of [...diff.droppedIndexes, ...diff.renamedIndexes.map(({ from }) => from)]) {
        statements.push(dropIndexSql(dialect, schema, original.name, index.name));
    }
    for (const dropped of diff.droppedColumns) {
        statements.push(`ALTER TABLE ${target} DROP COLUMN ${quote(dialect, dropped.name)}`);
    }
    for (const kept of diff.keptColumns.filter((candidate) => candidate.renamed)) {
        statements.push(`ALTER TABLE ${target} RENAME COLUMN ${quote(dialect, kept.original.name)} TO ${quote(dialect, kept.column.name)}`);
    }
    for (const added of diff.addedColumns) {
        statements.push(`ALTER TABLE ${target} ADD COLUMN ${columnSql(dialect, added.column)}`);
    }
    for (const index of [...diff.addedIndexes, ...diff.renamedIndexes.map(({ to }) => to)]) {
        statements.push(createIndexSql(dialect, schema, original.name, index));
    }
    if (diff.renamed) {
        statements.push(`ALTER TABLE ${target} RENAME TO ${quote(dialect, draft.name)}`);
    }
    return statements;
};
