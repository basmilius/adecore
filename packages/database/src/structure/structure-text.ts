import type { ForeignKeyInfo } from '../protocol/index.ts';

/* The target of a foreign key as SQL writes it: `schema.table(column, column)`. */
export const referenceOf = (key: ForeignKeyInfo): string => `${key.referencedSchema}.${key.referencedTable}(${key.referencedColumns.join(', ')})`;
