import type { Connection, TableRef } from '../client/types.ts';
import type { SchemaInfo, TableInfo } from '../protocol/index.ts';

/* Where a lazy list stands: not asked for yet, on its way, failed, or here. */
export type Load<T> =
    | { readonly status: 'idle' }
    | { readonly status: 'loading' }
    | { readonly status: 'error'; readonly message: string }
    | { readonly status: 'ready'; readonly value: T };

export const IDLE: Load<never> = { status: 'idle' };

/* What a load fetches: the schemas of a connection, or the tables of one schema. */
export interface LoadTarget {
    readonly connectionId: string;
    readonly schema?: string;
}

const SEPARATOR = '\u0000';

export const connectionKey = (connectionId: string): string => `c:${connectionId}`;
export const schemaKey = (connectionId: string, schema: string): string => `s:${connectionId}${SEPARATOR}${schema}`;
export const tableKey = (ref: TableRef): string => `t:${ref.connectionId}${SEPARATOR}${ref.schema}${SEPARATOR}${ref.table}`;
export const loadKey = (target: LoadTarget): string =>
    target.schema === undefined ? connectionKey(target.connectionId) : schemaKey(target.connectionId, target.schema);

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
}

export interface SchemaRow extends RowBase {
    readonly kind: 'schema';
    readonly connection: Connection;
    readonly schema: string;
    readonly expanded: boolean;
    /* The tables loaded, or those that match the filter; `null` before they are loaded. */
    readonly count: number | null;
}

export interface TableRow extends RowBase {
    readonly kind: 'table';
    readonly ref: TableRef;
    readonly table: TableInfo;
}

export interface LoadingRow extends RowBase {
    readonly kind: 'loading';
}

export interface ErrorRow extends RowBase {
    readonly kind: 'error';
    readonly message: string;
    readonly retry: LoadTarget;
}

/* A connection without schemas, or a schema without tables. */
export interface EmptyRow extends RowBase {
    readonly kind: 'empty';
    readonly of: 'schemas' | 'tables';
}

export type TreeRow = ConnectionRow | SchemaRow | TableRow | LoadingRow | ErrorRow | EmptyRow;

export type ExpandableRow = ConnectionRow | SchemaRow;

export const isExpandable = (row: TreeRow): row is ExpandableRow => row.kind === 'connection' || row.kind === 'schema';

export interface TreeInput {
    readonly connections: readonly Connection[];
    readonly expanded: ReadonlySet<string>;
    readonly filter: string;
    readonly showSystemSchemas: boolean;
    schemas(connectionId: string): Load<readonly SchemaInfo[]>;
    tables(connectionId: string, schema: string): Load<readonly TableInfo[]>;
}

/* The schemas a list shows. */
export const visibleSchemas = (schemas: readonly SchemaInfo[], showSystemSchemas: boolean): readonly SchemaInfo[] =>
    showSystemSchemas ? schemas : schemas.filter((schema) => !schema.system);

/* One schema is no level worth a row: its tables hang straight under the connection. */
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

type StatusRow = { kind: 'loading' } | { kind: 'empty'; of: 'schemas' | 'tables' } | { kind: 'error'; message: string; retry: LoadTarget };

const statusDraft = (row: StatusRow, level: number, parent: string, focusable: boolean): Draft => ({
    make: (place) => ({ ...row, key: `${row.kind}:${parent}`, level, parent, focusable, ...place }),
    below: []
});

const matches = (name: string, query: string): boolean => name.toLowerCase().includes(query);

/*
 * The rows a tree shows, top to bottom. With a filter only the loaded tables that match stay, under
 * their schema and connection, which then count as open whatever the person left them at.
 */
export const flattenTree = (input: TreeInput): TreeRow[] => {
    const query = input.filter.trim().toLowerCase();
    const filtering = query !== '';

    /* The rows under a schema, and how many of them are tables. */
    const tableDrafts = (connection: Connection, schema: string, level: number, parent: string): { drafts: Draft[]; tables: number } => {
        const load = input.tables(connection.id, schema);
        if (load.status === 'ready') {
            const shown = filtering ? load.value.filter((table) => matches(table.name, query)) : load.value;
            if (shown.length === 0 && !filtering) {
                return { drafts: [statusDraft({ kind: 'empty', of: 'tables' }, level, parent, true)], tables: 0 };
            }
            const drafts = shown.map((table): Draft => {
                const ref: TableRef = { connectionId: connection.id, schema, table: table.name };
                return { make: (place) => ({ kind: 'table', key: tableKey(ref), level, parent, focusable: true, ref, table, ...place }), below: [] };
            });
            return { drafts, tables: drafts.length };
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
        const { drafts, tables } = tableDrafts(connection, schema, 3, key);
        if (filtering && tables === 0) {
            return null;
        }
        const open = filtering || input.expanded.has(key);
        const load = input.tables(connection.id, schema);
        const count = load.status === 'ready' ? (filtering ? tables : load.value.length) : null;
        return {
            make: (place) => ({ kind: 'schema', key, level: 2, parent, focusable: true, connection, schema, expanded: open, count, ...place }),
            below: open ? settle(drafts) : []
        };
    };

    const connectionDraft = (connection: Connection): Draft | null => {
        const key = connectionKey(connection.id);
        const load = input.schemas(connection.id);
        const open = filtering ? load.status === 'ready' : input.expanded.has(key);
        let children: Draft[] = [];
        if (load.status === 'ready') {
            const visible = visibleSchemas(load.value, input.showSystemSchemas);
            const sole = soleSchema(visible);
            if (sole !== null) {
                children = open ? tableDrafts(connection, sole, 2, key).drafts : [];
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
        return {
            make: (place) => ({ kind: 'connection', key, level: 1, parent: null, focusable: true, connection, expanded: open, ...place }),
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
            if (input.tables(connection.id, schema).status === 'idle') {
                needed.push({ connectionId: connection.id, schema });
            }
        }
    }
    return needed;
};

export type TreeAction =
    | { readonly type: 'focus'; readonly key: string }
    | { readonly type: 'expand'; readonly key: string }
    | { readonly type: 'collapse'; readonly key: string }
    /* Enter or Space: opens a table, toggles a connection or a schema, retries a failed load. */
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
