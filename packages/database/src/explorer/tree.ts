import type { ExplorerSelection } from '../actions.ts';
import type { Connection, TableRef } from '../client/types.ts';
import type { ColumnInfo, Engine, SchemaInfo, TableInfo, TableKind, TableStructure } from '../protocol/index.ts';
import { qualifiedName } from '../sql.ts';

/* Where a lazy list stands: not asked for yet, on its way, failed, or here. */
export type Load<T> =
    | { readonly status: 'idle' }
    | { readonly status: 'loading' }
    | { readonly status: 'error'; readonly message: string }
    | { readonly status: 'ready'; readonly value: T };

export const IDLE: Load<never> = { status: 'idle' };

/* What a load fetches: the schemas of a connection, the tables of one schema, or the structure of one table. */
export interface LoadTarget {
    readonly connectionId: string;
    readonly schema?: string;
    /* Only with `schema`. */
    readonly table?: string;
}

const SEPARATOR = '\u0000';

export const connectionKey = (connectionId: string): string => `c:${connectionId}`;
export const schemaKey = (connectionId: string, schema: string): string => `s:${connectionId}${SEPARATOR}${schema}`;
export const folderKey = (connectionId: string, schema: string, group: TableKind): string => `f:${connectionId}${SEPARATOR}${schema}${SEPARATOR}${group}`;
export const tableKey = (ref: TableRef): string => `t:${ref.connectionId}${SEPARATOR}${ref.schema}${SEPARATOR}${ref.table}`;
export const isFolderKey = (key: string): boolean => key.startsWith('f:');
export const columnKey = (ref: TableRef, column: string): string => `${tableKey(ref)}${SEPARATOR}${column}`;

export const loadKey = (target: LoadTarget): string => {
    if (target.schema === undefined) {
        return connectionKey(target.connectionId);
    }
    return target.table === undefined
        ? schemaKey(target.connectionId, target.schema)
        : tableKey({ connectionId: target.connectionId, schema: target.schema, table: target.table });
};

/* The kinds of table a schema lists, in the order of its folders. */
export const GROUPS: readonly TableKind[] = ['table', 'view'];

interface RowBase {
    readonly key: string;
    /* 1 for a connection. */
    readonly level: number;
    readonly parent: string | null;
    readonly posInSet: number;
    readonly setSize: number;
    /* A row that says it is loading is no stop for the arrow keys. */
    readonly focusable: boolean;
}

export interface ConnectionRow extends RowBase {
    readonly kind: 'connection';
    readonly connection: Connection;
    readonly expanded: boolean;
    /* What the server reported once the person opened the connection; `null` before that. */
    readonly version: string | null;
    /* Only when the system schemas are hidden and there are some: how many show out of how many exist. */
    readonly schemaCount: { readonly shown: number; readonly total: number } | null;
}

export interface SchemaRow extends RowBase {
    readonly kind: 'schema';
    readonly connection: Connection;
    readonly schema: string;
    readonly expanded: boolean;
}

/* The "Tables" or the "Views" of a schema; it exists only when the schema has some. */
export interface FolderRow extends RowBase {
    readonly kind: 'folder';
    readonly connection: Connection;
    readonly schema: string;
    readonly group: TableKind;
    readonly expanded: boolean;
    /* The tables loaded, or those that match the filter. */
    readonly count: number;
}

export interface TableRow extends RowBase {
    readonly kind: 'table';
    readonly ref: TableRef;
    readonly table: TableInfo;
    readonly expanded: boolean;
}

export interface ColumnRow extends RowBase {
    readonly kind: 'column';
    /* The table the column belongs to, which is what opening it opens. */
    readonly ref: TableRef;
    readonly column: ColumnInfo;
    readonly primaryKey: boolean;
    readonly foreignKey: boolean;
}

export interface LoadingRow extends RowBase {
    readonly kind: 'loading';
}

export interface ErrorRow extends RowBase {
    readonly kind: 'error';
    readonly message: string;
    readonly retry: LoadTarget;
}

/* A connection without schemas, a schema without tables or a table without columns. */
export interface EmptyRow extends RowBase {
    readonly kind: 'empty';
    readonly of: 'schemas' | 'tables' | 'columns';
}

export type TreeRow = ConnectionRow | SchemaRow | FolderRow | TableRow | ColumnRow | LoadingRow | ErrorRow | EmptyRow;

export type ExpandableRow = ConnectionRow | SchemaRow | FolderRow | TableRow;

export const isExpandable = (row: TreeRow): row is ExpandableRow =>
    row.kind === 'connection' || row.kind === 'schema' || row.kind === 'folder' || row.kind === 'table';

/* The table a row stands for, when it stands for one. */
export const tableOf = (row: TreeRow): TableRef | null => (row.kind === 'table' || row.kind === 'column' ? row.ref : null);

/* What picking a row selects: its connection, its schema, or its table (a column stands for its table). Status rows select nothing. */
export const selectionOf = (row: TreeRow): ExplorerSelection | null => {
    switch (row.kind) {
        case 'connection':
            return { connectionId: row.connection.id };
        case 'schema':
        case 'folder':
            return { connectionId: row.connection.id, schema: row.schema };
        case 'table':
        case 'column':
            return { connectionId: row.ref.connectionId, schema: row.ref.schema, table: row.ref.table };
        default:
            return null;
    }
};

/* The key of the row a selection points at: its table, else its schema, else its connection. */
export const selectionKey = (selection: ExplorerSelection): string => {
    if (selection.schema === undefined) {
        return connectionKey(selection.connectionId);
    }
    return selection.table === undefined
        ? schemaKey(selection.connectionId, selection.schema)
        : tableKey({ connectionId: selection.connectionId, schema: selection.schema, table: selection.table });
};

/* Whether a row has a menu: the rows of a connection, a schema, a table or a column, and none of the rows that only report. */
export const hasMenu = (row: TreeRow): boolean =>
    row.kind === 'connection' || row.kind === 'schema' || row.kind === 'folder' || row.kind === 'table' || row.kind === 'column';

/* Only the rows a selection can point at are drawn selected; a folder or a column leaves that to the row above it. */
export const isSelectable = (row: TreeRow): boolean => row.kind === 'connection' || row.kind === 'schema' || row.kind === 'table';

/* The statement behind New console here on a table: every row, as the engine quotes it. */
export const selectAllSql = (engine: Engine, ref: TableRef): string => `SELECT * FROM ${qualifiedName({ engine, schema: ref.schema, table: ref.table })}`;

export interface TreeInput {
    readonly connections: readonly Connection[];
    /* Connections, schemas and tables the person opened. Folders are open unless they are in `collapsed`. */
    readonly expanded: ReadonlySet<string>;
    readonly collapsed: ReadonlySet<string>;
    readonly filter: string;
    readonly showSystemSchemas: boolean;
    schemas(connectionId: string): Load<readonly SchemaInfo[]>;
    tables(connectionId: string, schema: string): Load<readonly TableInfo[]>;
    structures(connectionId: string, schema: string, table: string): Load<TableStructure>;
    versions(connectionId: string): string | null;
}

/* The schemas a list shows. */
export const visibleSchemas = (schemas: readonly SchemaInfo[], showSystemSchemas: boolean): readonly SchemaInfo[] =>
    showSystemSchemas ? schemas : schemas.filter((schema) => !schema.system);

/* One schema is no level worth a row: its folders hang straight under the connection. */
const soleSchema = (visible: readonly SchemaInfo[]): string | null => (visible.length === 1 ? visible[0]!.name : null);

interface Place {
    readonly posInSet: number;
    readonly setSize: number;
}

/* A row before its place among its siblings is known, with the rows under it. */
interface Draft {
    readonly make: (place: Place) => TreeRow;
    readonly below: readonly TreeRow[];
}

/* Gives the drafts of one parent their place among each other, and lays them out depth first. */
const settle = (drafts: readonly Draft[]): TreeRow[] => drafts.flatMap((draft, i) => [draft.make({ posInSet: i + 1, setSize: drafts.length }), ...draft.below]);

type StatusRow = { kind: 'loading' } | { kind: 'empty'; of: EmptyRow['of'] } | { kind: 'error'; message: string; retry: LoadTarget };

const statusDraft = (row: StatusRow, level: number, parent: string, focusable: boolean): Draft => ({
    make: (place) => ({ ...row, key: `${row.kind}:${parent}`, level, parent, focusable, ...place }),
    below: []
});

const matches = (name: string, query: string): boolean => name.toLowerCase().includes(query);

/*
 * The rows a tree shows, top to bottom. With a filter only the loaded tables that match stay, under
 * their folder, schema and connection, which then count as open whatever the person left them at.
 */
export const flattenTree = (input: TreeInput): TreeRow[] => {
    const query = input.filter.trim().toLowerCase();
    const filtering = query !== '';

    const columnDrafts = (ref: TableRef, level: number, parent: string): Draft[] => {
        const load = input.structures(ref.connectionId, ref.schema, ref.table);
        if (load.status !== 'ready') {
            const row: StatusRow =
                load.status === 'error'
                    ? { kind: 'error', message: load.message, retry: { connectionId: ref.connectionId, schema: ref.schema, table: ref.table } }
                    : { kind: 'loading' };
            return [statusDraft(row, level, parent, load.status === 'error')];
        }
        const { columns, primaryKey, foreignKeys } = load.value;
        if (columns.length === 0) {
            return [statusDraft({ kind: 'empty', of: 'columns' }, level, parent, true)];
        }
        const primary = new Set(primaryKey);
        const foreign = new Set(foreignKeys.flatMap((foreignKey) => foreignKey.columns));
        return columns.map((column): Draft => ({
            make: (place) => ({
                kind: 'column',
                key: columnKey(ref, column.name),
                level,
                parent,
                focusable: true,
                ref,
                column,
                primaryKey: primary.has(column.name),
                foreignKey: foreign.has(column.name),
                ...place
            }),
            below: []
        }));
    };

    const tableDraft = (ref: TableRef, table: TableInfo, level: number, parent: string): Draft => {
        const key = tableKey(ref);
        const open = input.expanded.has(key);
        return {
            make: (place) => ({ kind: 'table', key, level, parent, focusable: true, ref, table, expanded: open, ...place }),
            below: open ? settle(columnDrafts(ref, level + 1, key)) : []
        };
    };

    /* The folders under a schema (or under a connection with only that schema), and how many tables they hold. */
    const folderDrafts = (connection: Connection, schema: string, level: number, parent: string): { drafts: Draft[]; tables: number } => {
        const load = input.tables(connection.id, schema);
        if (load.status === 'ready') {
            const shown = filtering ? load.value.filter((table) => matches(table.name, query)) : load.value;
            if (shown.length === 0 && !filtering) {
                return { drafts: [statusDraft({ kind: 'empty', of: 'tables' }, level, parent, true)], tables: 0 };
            }
            const drafts = GROUPS.flatMap((group): Draft[] => {
                const members = shown.filter((table) => table.kind === group);
                if (members.length === 0) {
                    return [];
                }
                const key = folderKey(connection.id, schema, group);
                const open = filtering || !input.collapsed.has(key);
                const tables = members.map((table) => tableDraft({ connectionId: connection.id, schema, table: table.name }, table, level + 1, key));
                return [
                    {
                        make: (place) => ({
                            kind: 'folder',
                            key,
                            level,
                            parent,
                            focusable: true,
                            connection,
                            schema,
                            group,
                            expanded: open,
                            count: members.length,
                            ...place
                        }),
                        below: open ? settle(tables) : []
                    }
                ];
            });
            return { drafts, tables: shown.length };
        }
        if (filtering) {
            return { drafts: [], tables: 0 };
        }
        const row: StatusRow =
            load.status === 'error' ? { kind: 'error', message: load.message, retry: { connectionId: connection.id, schema } } : { kind: 'loading' };
        return { drafts: [statusDraft(row, level, parent, load.status === 'error')], tables: 0 };
    };

    const schemaDraft = (connection: Connection, schema: string, parent: string): Draft | null => {
        const key = schemaKey(connection.id, schema);
        const { drafts, tables } = folderDrafts(connection, schema, 3, key);
        if (filtering && tables === 0) {
            return null;
        }
        const open = filtering || input.expanded.has(key);
        return {
            make: (place) => ({ kind: 'schema', key, level: 2, parent, focusable: true, connection, schema, expanded: open, ...place }),
            below: open ? settle(drafts) : []
        };
    };

    const connectionDraft = (connection: Connection): Draft | null => {
        const key = connectionKey(connection.id);
        const load = input.schemas(connection.id);
        const open = filtering ? load.status === 'ready' : input.expanded.has(key);
        let children: Draft[] = [];
        let schemaCount: ConnectionRow['schemaCount'] = null;
        if (load.status === 'ready') {
            const visible = visibleSchemas(load.value, input.showSystemSchemas);
            const sole = soleSchema(visible);
            if (visible.length < load.value.length) {
                schemaCount = { shown: visible.length, total: load.value.length };
            }
            if (sole !== null) {
                children = open ? folderDrafts(connection, sole, 2, key).drafts : [];
            } else if (visible.length === 0) {
                children = open && !filtering ? [statusDraft({ kind: 'empty', of: 'schemas' }, 2, key, true)] : [];
            } else {
                children = visible.flatMap((entry) => schemaDraft(connection, entry.name, key) ?? []);
            }
        } else if (open) {
            const row: StatusRow =
                load.status === 'error' ? { kind: 'error', message: load.message, retry: { connectionId: connection.id } } : { kind: 'loading' };
            children = [statusDraft(row, 2, key, load.status === 'error')];
        }
        if (filtering && children.length === 0) {
            return null;
        }
        const version = input.versions(connection.id);
        return {
            make: (place) => ({ kind: 'connection', key, level: 1, parent: null, focusable: true, connection, expanded: open, version, schemaCount, ...place }),
            below: open ? settle(children) : []
        };
    };

    return settle(input.connections.flatMap((connection) => connectionDraft(connection) ?? []));
};

/* The loads an open node is waiting for and nobody has asked for yet. */
export const neededLoads = (input: Omit<TreeInput, 'filter'>): LoadTarget[] => {
    const needed: LoadTarget[] = [];
    for (const connection of input.connections) {
        if (!input.expanded.has(connectionKey(connection.id))) {
            continue;
        }
        const load = input.schemas(connection.id);
        if (load.status === 'idle') {
            needed.push({ connectionId: connection.id });
            continue;
        }
        if (load.status !== 'ready') {
            continue;
        }
        const visible = visibleSchemas(load.value, input.showSystemSchemas);
        const sole = soleSchema(visible);
        const wanted = sole !== null ? [sole] : visible.map((schema) => schema.name).filter((name) => input.expanded.has(schemaKey(connection.id, name)));
        for (const schema of wanted) {
            const tables = input.tables(connection.id, schema);
            if (tables.status === 'idle') {
                needed.push({ connectionId: connection.id, schema });
                continue;
            }
            if (tables.status !== 'ready') {
                continue;
            }
            for (const table of tables.value) {
                if (
                    input.expanded.has(tableKey({ connectionId: connection.id, schema, table: table.name })) &&
                    input.structures(connection.id, schema, table.name).status === 'idle'
                ) {
                    needed.push({ connectionId: connection.id, schema, table: table.name });
                }
            }
        }
    }
    return needed;
};

export type TreeAction =
    | { readonly type: 'focus'; readonly key: string }
    | { readonly type: 'expand'; readonly key: string }
    | { readonly type: 'collapse'; readonly key: string }
    /* Enter or Space: opens a table (or the table of a column), toggles a node, retries a failed load. */
    | { readonly type: 'activate'; readonly key: string };

/* What a key does to the row that has the focus, or `null` when it does nothing there. */
export const navigate = (rows: readonly TreeRow[], activeKey: string | null, pressed: string): TreeAction | null => {
    const stops = rows.filter((row) => row.focusable);
    if (stops.length === 0) {
        return null;
    }
    const at = stops.findIndex((row) => row.key === activeKey);
    const row = at === -1 ? null : stops[at]!;
    switch (pressed) {
        case 'ArrowDown':
            return { type: 'focus', key: stops[Math.min(at + 1, stops.length - 1)]!.key };
        case 'ArrowUp':
            return { type: 'focus', key: stops[Math.max(at - 1, 0)]!.key };
        case 'Home':
            return { type: 'focus', key: stops[0]!.key };
        case 'End':
            return { type: 'focus', key: stops[stops.length - 1]!.key };
        case 'ArrowRight': {
            if (row === null || !isExpandable(row)) {
                return null;
            }
            if (!row.expanded) {
                return { type: 'expand', key: row.key };
            }
            const child = stops.find((candidate) => candidate.parent === row.key);
            return child === undefined ? null : { type: 'focus', key: child.key };
        }
        case 'ArrowLeft': {
            if (row === null) {
                return null;
            }
            if (isExpandable(row) && row.expanded) {
                return { type: 'collapse', key: row.key };
            }
            return row.parent === null ? null : { type: 'focus', key: row.parent };
        }
        case 'Enter':
        case ' ':
            return row === null ? null : { type: 'activate', key: row.key };
        default:
            return null;
    }
};

/* The row that takes the tab stop: the one with the focus, else the selected table, else the first. */
export const tabStop = (rows: readonly TreeRow[], activeKey: string | null, selectedKey: string | null): string | null => {
    for (const key of [activeKey, selectedKey]) {
        if (key !== null && rows.some((row) => row.key === key && row.focusable)) {
            return key;
        }
    }
    return rows.find((row) => row.focusable)?.key ?? null;
};
