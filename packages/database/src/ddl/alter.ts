import type { TableStructure } from '../protocol/index.ts';
import { mysqlAlterSql } from './alter-mysql.ts';
import { sqliteAlterSql } from './alter-sqlite.ts';
import type { Dialect } from './dialect.ts';
import { diffOf, type TableDiff } from './diff.ts';
import { draftOf, type TableDraft } from './draft.ts';

const unchanged = (diff: TableDiff): boolean =>
    !diff.renamed &&
    !diff.optionsChanged &&
    !diff.primaryKeyChanged &&
    diff.droppedColumns.length === 0 &&
    diff.addedColumns.length === 0 &&
    diff.keptColumns.every((kept) => !kept.renamed && !kept.redefined && !kept.moved) &&
    diff.droppedIndexes.length === 0 &&
    diff.addedIndexes.length === 0 &&
    diff.renamedIndexes.length === 0 &&
    diff.droppedForeignKeys.length === 0 &&
    diff.addedForeignKeys.length === 0;

/* The fewest statements that turn the table of `structure` into the draft; none when the draft changes nothing. */
export const alterTableSql = (dialect: Dialect, schema: string, structure: TableStructure, draft: TableDraft): string[] => {
    const original = draftOf(structure);
    const diff = diffOf(dialect, original, draft);
    if (unchanged(diff)) {
        return [];
    }
    return dialect.engine === 'sqlite' ? sqliteAlterSql(dialect, schema, original, draft, diff) : mysqlAlterSql(dialect, schema, original, draft, diff);
};
