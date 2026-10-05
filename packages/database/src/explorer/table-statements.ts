import type { TableRef } from '../client/types.ts';
import { dropTableSql, dropViewSql, renameTableSql, truncateTableSql, type Dialect } from '../ddl/index.ts';
import type { TableKind } from '../protocol/index.ts';

/* What the explorer's menu changes about a table: its name, its rows, or its existence. */
export type TableChange = 'rename' | 'truncate' | 'drop';

/* The statement for a change; `to` is the new name of a rename. */
export const statementOf = (dialect: Dialect, change: TableChange, ref: TableRef, kind: TableKind, to = ref.table): string => {
    switch (change) {
        case 'rename':
            return renameTableSql(dialect, ref.schema, ref.table, to);
        case 'truncate':
            return truncateTableSql(dialect, ref.schema, ref.table);
        case 'drop':
            return kind === 'view' ? dropViewSql(dialect, ref.schema, ref.table) : dropTableSql(dialect, ref.schema, ref.table);
    }
};
