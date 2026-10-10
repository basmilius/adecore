import { columnSpecSql } from './column.ts';
import { foreignKeySql, inlineIndexSql, mysqlOptionsSql } from './create.ts';
import { columnList, quote, tableName, type Dialect } from './dialect.ts';
import type { TableDiff } from './diff.ts';
import type { ColumnDraft, TableDraft } from './draft.ts';

const positionSql = (dialect: Dialect, after: string | null): string => (after === null ? 'FIRST' : `AFTER ${quote(dialect, after)}`);

const withPosition = (clause: string, position: string | null): string => (position === null ? clause : `${clause} ${position}`);

/*
 * One `ALTER TABLE`, or two when it has to be. A position clause names the columns as they are
 * called after a rename, and a foreign key cannot be dropped and added again under the same name
 * in one statement, so both put the drops and renames in a statement of their own, first.
 */
export const mysqlAlterSql = (dialect: Dialect, schema: string, original: TableDraft, draft: TableDraft, diff: TableDiff): string[] => {
    const early: string[] = [];
    const late: string[] = [];
    const column = (verb: 'CHANGE' | 'MODIFY' | 'ADD', target: ColumnDraft, previous: string | null, position: string | null): string => {
        const spec = columnSpecSql(dialect, target);
        const named = verb === 'CHANGE' ? `${quote(dialect, previous!)} ${quote(dialect, target.name)}` : quote(dialect, target.name);
        return withPosition(`${verb} COLUMN ${named} ${spec}`, position);
    };

    const positioned = diff.keptColumns.some((kept) => kept.moved) || diff.addedColumns.some((added) => added.placed);
    const reusesName = diff.droppedForeignKeys.some((dropped) => dropped.name !== '' && diff.addedForeignKeys.some((added) => added.name === dropped.name));
    const split = (positioned && diff.keptColumns.some((kept) => kept.renamed)) || reusesName;

    for (const foreignKey of diff.droppedForeignKeys) {
        early.push(`DROP FOREIGN KEY ${quote(dialect, foreignKey.name)}`);
    }
    for (const index of diff.droppedIndexes) {
        early.push(`DROP INDEX ${quote(dialect, index.name)}`);
    }
    for (const { from, to } of diff.renamedIndexes) {
        early.push(`RENAME INDEX ${quote(dialect, from.name)} TO ${quote(dialect, to.name)}`);
    }
    if (diff.primaryKeyChanged && original.primaryKey.length > 0) {
        early.push('DROP PRIMARY KEY');
    }
    for (const dropped of diff.droppedColumns) {
        early.push(`DROP COLUMN ${quote(dialect, dropped.name)}`);
    }

    for (const kept of diff.keptColumns) {
        const verb = kept.renamed ? 'CHANGE' : 'MODIFY';
        if (split) {
            if (kept.renamed || kept.redefined) {
                early.push(column(verb, kept.column, kept.original.name, null));
            }
            if (kept.moved) {
                late.push(column('MODIFY', kept.column, null, positionSql(dialect, kept.after)));
            }
        } else if (kept.renamed || kept.redefined || kept.moved) {
            early.push(column(verb, kept.column, kept.original.name, kept.moved ? positionSql(dialect, kept.after) : null));
        }
    }
    for (const added of diff.addedColumns) {
        late.push(column('ADD', added.column, null, added.placed ? positionSql(dialect, added.after) : null));
    }

    if (diff.primaryKeyChanged && draft.primaryKey.length > 0) {
        late.push(`ADD PRIMARY KEY (${columnList(dialect, draft.primaryKey)})`);
    }
    for (const index of diff.addedIndexes) {
        late.push(`ADD ${inlineIndexSql(dialect, index)}`);
    }
    for (const foreignKey of diff.addedForeignKeys) {
        late.push(`ADD ${foreignKeySql(dialect, schema, foreignKey)}`);
    }
    const options = diff.optionsChanged ? mysqlOptionsSql(draft.options, original.options).join(' ') : '';
    if (options !== '') {
        late.push(options);
    }
    if (diff.renamed) {
        late.push(`RENAME TO ${quote(dialect, draft.name)}`);
    }

    const target = tableName(dialect, schema, original.name);
    const statement = (clauses: readonly string[]): string[] => (clauses.length === 0 ? [] : [`ALTER TABLE ${target}\n    ${clauses.join(',\n    ')}`]);
    return split ? [...statement(early), ...statement(late)] : statement([...early, ...late]);
};
