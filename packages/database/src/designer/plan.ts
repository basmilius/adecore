import { alterTableSql, createTableSql, dropsColumns, draftOf, validateDraft, type Dialect, type DraftProblem, type TableDraft } from '../ddl/index.ts';
import type { TableStructure } from '../protocol/index.ts';

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

export const scriptOf = (statements: readonly string[]): string => statements.map((statement) => `${statement};`).join('\n');
