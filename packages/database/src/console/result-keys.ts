import { useEffect, useMemo, useState } from 'react';
import type { DatabaseSession } from '../client/types.ts';
import type { Shown } from '../grid/display.ts';
import type { GridColumn } from '../grid/types.ts';
import type { ColumnSource, Engine, ResultColumn, StatementResult, TableStructure } from '../protocol/index.ts';
import { foreignKeyOf, referenceOf, type Reference } from '../table/references.ts';

/* What the tables a result reads from say about its columns: their keys, and where a foreign key points. */
export interface ResultKeys {
    readonly columns: readonly GridColumn[];
    /* Whether a column is part of a foreign key of the table it comes from. */
    isReference(column: number): boolean;
    /* The row the foreign key of a column points to, from the cells of a row of the result; `null` when it points nowhere. */
    referenceAt(column: number, cells: readonly Shown[]): Reference | null;
}

type TableName = Pick<ColumnSource, 'schema' | 'table'>;

const tableKey = ({ schema, table }: TableName): string => `${schema}\u0000${table}`;

/* The tables the columns of a result come from, each once, in the order they first appear. */
export const sourceTablesOf = (columns: readonly ResultColumn[]): TableName[] => {
    const tables = new Map<string, TableName>();
    for (const { source } of columns) {
        if (source !== undefined && !tables.has(tableKey(source))) {
            tables.set(tableKey(source), { schema: source.schema, table: source.table });
        }
    }
    return [...tables.values()];
};

/*
 * The keys of a result's columns, from the structures of the tables they come from by key (`schema`, NUL,
 * `table`). A column without a source, or of a table with no structure, is marked as nothing.
 */
export const resultKeysOf = (engine: Engine, columns: readonly ResultColumn[], structures: ReadonlyMap<string, TableStructure>): ResultKeys => {
    const structureOf = (column: ResultColumn | undefined): TableStructure | undefined =>
        column?.source === undefined ? undefined : structures.get(tableKey(column.source));
    const foreignKeyAt = (column: number) => {
        const source = columns[column]?.source;
        const structure = structureOf(columns[column]);
        return source === undefined || structure === undefined ? undefined : foreignKeyOf(structure.foreignKeys, source.column);
    };
    return {
        columns: columns.map((column): GridColumn => {
            const structure = structureOf(column);
            const name = column.source?.column;
            if (structure === undefined || name === undefined) {
                return column;
            }
            return {
                ...column,
                primaryKey: structure.primaryKey.includes(name),
                foreignKey: structure.foreignKeys.some((key) => key.columns.includes(name))
            };
        }),
        isReference: (column) => foreignKeyAt(column) !== undefined,
        referenceAt: (column, cells) => {
            const key = foreignKeyAt(column);
            const source = columns[column]?.source;
            if (key === undefined || source === undefined) {
                return null;
            }
            // The columns of the result as the columns of that table, so a join names each key column of its own table only.
            const asTable = columns.map((entry) => ({
                name: entry.source !== undefined && tableKey(entry.source) === tableKey(source) ? entry.source.column : '',
                kind: entry.kind
            }));
            return referenceOf(engine, key, asTable, cells);
        }
    };
};

/*
 * The keys of a result set, once the structures of the tables its columns come from have loaded: each table
 * once per result, through the console's session. `null` while they load and for what is no result set.
 */
export function useResultKeys(session: DatabaseSession | null, engine: Engine | undefined, result: StatementResult | undefined): ResultKeys | null {
    const [loaded, setLoaded] = useState<{ readonly result: StatementResult; readonly structures: ReadonlyMap<string, TableStructure> } | null>(null);

    useEffect(() => {
        if (session === null || result?.kind !== 'rows') {
            return undefined;
        }
        const tables = sourceTablesOf(result.columns);
        if (tables.length === 0) {
            return undefined;
        }
        const controller = new AbortController();
        // A table the server named but cannot describe, such as a derived one, marks no column.
        const loads = tables.map((table) =>
            session.structure(table.schema, table.table, { signal: controller.signal }).then(
                (structure): [string, TableStructure] => [tableKey(table), structure],
                () => null
            )
        );
        void Promise.all(loads).then((entries) => {
            if (!controller.signal.aborted) {
                setLoaded({ result, structures: new Map(entries.filter((entry) => entry !== null)) });
            }
        });
        return () => controller.abort();
    }, [session, result]);

    return useMemo(
        () => (engine === undefined || result?.kind !== 'rows' || loaded?.result !== result ? null : resultKeysOf(engine, result.columns, loaded.structures)),
        [engine, result, loaded]
    );
}
