import type { Dialect } from './dialect.ts';
import type { TableDraft } from './draft.ts';

/* What stops a draft from becoming SQL. `subject` names the item it is about, empty for the table itself. */
export interface DraftProblem {
    readonly code: 'tableName' | 'noColumns' | 'columnName' | 'columnDuplicate' | 'columnType' | 'indexName' | 'indexColumns' | 'foreignKey';
    readonly subject: string;
}

export const validateDraft = (dialect: Dialect, draft: TableDraft): DraftProblem[] => {
    const problems: DraftProblem[] = [];
    if (draft.name.trim() === '') {
        problems.push({ code: 'tableName', subject: '' });
    }
    if (draft.columns.length === 0) {
        problems.push({ code: 'noColumns', subject: '' });
    }
    const seen = new Set<string>();
    for (const column of draft.columns) {
        const folded = column.name.toLowerCase();
        if (column.name.trim() === '') {
            problems.push({ code: 'columnName', subject: '' });
        } else if (seen.has(folded)) {
            problems.push({ code: 'columnDuplicate', subject: column.name });
        }
        seen.add(folded);
        if (dialect.engine === 'mysql' && column.type.trim() === '' && column.name.trim() !== '') {
            problems.push({ code: 'columnType', subject: column.name });
        }
    }
    for (const index of draft.indexes) {
        if (index.columns.length === 0) {
            problems.push({ code: 'indexColumns', subject: index.name });
        }
        if (dialect.engine === 'sqlite' && index.name.trim() === '') {
            problems.push({ code: 'indexName', subject: '' });
        }
    }
    for (const foreignKey of draft.foreignKeys) {
        const complete =
            foreignKey.columns.length > 0 && foreignKey.referencedTable !== '' && foreignKey.referencedColumns.length === foreignKey.columns.length;
        if (!complete) {
            problems.push({ code: 'foreignKey', subject: foreignKey.name });
        }
    }
    return problems;
};
