import type { TableStructure } from '../protocol/index.ts';
import { alterTableSql, createTableSql, dropsColumns, draftOf, validateDraft, type Dialect, type DraftProblem, type TableDraft } from '../ddl/index.ts';

/* What applying a draft would do. */
export interface Plan {
    readonly problems: readonly DraftProblem[];
    /* Empty while there are problems, since a draft that does not hold together has no SQL. */
    readonly statements: readonly string[];
    /* Whether the statements remove a column and the data in it. */
    readonly destructive: boolean;
}

export const planOf = (dialect: Dialect, schema: string, structure: TableStructure | null, draft: TableDraft): Plan => {
    const problems = validateDraft(dialect, draft);
    if (problems.length > 0) {
        return { problems, statements: [], destructive: false };
    }
    if (structure === null) {
        return { problems, statements: createTableSql(dialect, schema, draft), destructive: false };
    }
    return { problems, statements: alterTableSql(dialect, schema, structure, draft), destructive: dropsColumns(draftOf(structure), draft) };
};

/* The statements as a person reads them and as a script runs them. */
export const scriptOf = (statements: readonly string[]): string => statements.map((statement) => `${statement};`).join('\n');
