import type { TableRef } from '../client/types.ts';

export type TableViewMode = 'data' | 'structure';

export type WorkbenchTab =
    | { readonly id: string; readonly kind: 'table'; readonly ref: TableRef; readonly view: TableViewMode; readonly where?: string }
    | { readonly id: string; readonly kind: 'console'; readonly connectionId: string; readonly schema?: string; readonly sql: string; readonly number: number }
    /* Without `table` the designer makes a new table. */
    | { readonly id: string; readonly kind: 'designer'; readonly connectionId: string; readonly schema: string; readonly table?: string };

export interface WorkbenchState {
    readonly tabs: readonly WorkbenchTab[];
    readonly activeId: string | null;
    /* The next number for an id that is not derived from what the tab shows. Never reused, so a restored tab cannot clash with a new one. */
    readonly serial: number;
    /* The number the last console got, for its title. */
    readonly consoles: number;
}

export const STORAGE_KEY = 'database:workbench';

export const emptyState: WorkbenchState = { tabs: [], activeId: null, serial: 0, consoles: 0 };

export const connectionIdOf = (tab: WorkbenchTab): string => (tab.kind === 'table' ? tab.ref.connectionId : tab.connectionId);

const tableTabId = (ref: TableRef): string => `table:${ref.connectionId}\u0000${ref.schema}\u0000${ref.table}`;

const isDesignerOf = (tab: WorkbenchTab, connectionId: string, schema: string, table: string): boolean =>
    tab.kind === 'designer' && tab.connectionId === connectionId && tab.schema === schema && tab.table === table;

const add = (state: WorkbenchState, tab: WorkbenchTab): WorkbenchState => ({ ...state, tabs: [...state.tabs, tab], activeId: tab.id });

const update = (state: WorkbenchState, id: string, change: (tab: WorkbenchTab) => WorkbenchTab): WorkbenchState => {
    let changed = false;
    const tabs = state.tabs.map((tab) => {
        if (tab.id !== id) {
            return tab;
        }
        const next = change(tab);
        changed ||= next !== tab;
        return next;
    });
    return changed ? { ...state, tabs } : state;
};

export const focusTab = (state: WorkbenchState, id: string): WorkbenchState =>
    state.activeId === id || !state.tabs.some((tab) => tab.id === id) ? state : { ...state, activeId: id };

/* A table opens once per table; a filtered one is always a tab of its own, since the filter is what the person asked to see. */
export const openTable = (state: WorkbenchState, ref: TableRef, view: TableViewMode, where?: string): WorkbenchState => {
    if (where !== undefined && where.trim() !== '') {
        return add({ ...state, serial: state.serial + 1 }, { id: `filtered:${state.serial + 1}`, kind: 'table', ref, view, where });
    }
    const id = tableTabId(ref);
    const existing = state.tabs.find((tab) => tab.id === id);
    if (existing === undefined) {
        return add(state, { id, kind: 'table', ref, view });
    }
    return focusTab(setTableView(state, id, view), id);
};

export const openConsole = (state: WorkbenchState, connectionId: string, schema?: string, sql = ''): WorkbenchState => {
    const serial = state.serial + 1;
    const consoles = state.consoles + 1;
    return add({ ...state, serial, consoles }, { id: `console:${serial}`, kind: 'console', connectionId, schema, sql, number: consoles });
};

/* A table is designed in one tab; a new table gets a tab each time. */
export const openDesigner = (state: WorkbenchState, connectionId: string, schema: string, table?: string): WorkbenchState => {
    const existing = table === undefined ? undefined : state.tabs.find((tab) => isDesignerOf(tab, connectionId, schema, table));
    if (existing !== undefined) {
        return focusTab(state, existing.id);
    }
    const serial = state.serial + 1;
    return add({ ...state, serial }, { id: `designer:${serial}`, kind: 'designer', connectionId, schema, table });
};

export const setTableView = (state: WorkbenchState, id: string, view: TableViewMode): WorkbenchState =>
    update(state, id, (tab) => (tab.kind === 'table' && tab.view !== view ? { ...tab, view } : tab));

export const setConsoleSql = (state: WorkbenchState, id: string, sql: string): WorkbenchState =>
    update(state, id, (tab) => (tab.kind === 'console' && tab.sql !== sql ? { ...tab, sql } : tab));

/* The designer of a new table became the designer of that table, in the same tab. Closes any other designer of it. */
export const setDesignerTable = (state: WorkbenchState, id: string, table: string): WorkbenchState => {
    const subject = state.tabs.find((tab) => tab.id === id);
    if (subject?.kind !== 'designer' || subject.table === table) {
        return state;
    }
    const tabs = state.tabs.filter((tab) => tab.id === id || !isDesignerOf(tab, subject.connectionId, subject.schema, table));
    return update({ ...state, tabs }, id, (tab) => (tab.kind === 'designer' ? { ...tab, table } : tab));
};

/* The tab next to the closed one comes forward when the closed one was in front. */
export const closeTab = (state: WorkbenchState, id: string): WorkbenchState => {
    const at = state.tabs.findIndex((tab) => tab.id === id);
    if (at < 0) {
        return state;
    }
    const tabs = state.tabs.filter((tab) => tab.id !== id);
    return { ...state, tabs, activeId: state.activeId === id ? (tabs[Math.min(at, tabs.length - 1)]?.id ?? null) : state.activeId };
};

/* Drops the tabs of connections that are gone. */
export const pruneTabs = (state: WorkbenchState, connectionIds: ReadonlySet<string>): WorkbenchState => {
    const tabs = state.tabs.filter((tab) => connectionIds.has(connectionIdOf(tab)));
    if (tabs.length === state.tabs.length) {
        return state;
    }
    return { ...state, tabs, activeId: tabs.some((tab) => tab.id === state.activeId) ? state.activeId : (tabs.at(-1)?.id ?? null) };
};

export const serializeState = (state: WorkbenchState): string => JSON.stringify({ version: 1, ...state });

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

const isOptionalText = (value: unknown): value is string | undefined => value === undefined || typeof value === 'string';

const refOf = (value: unknown): TableRef | null => {
    const ref = value as Partial<Record<keyof TableRef, unknown>> | null;
    return typeof ref === 'object' && ref !== null && isText(ref.connectionId) && isText(ref.schema) && isText(ref.table)
        ? { connectionId: ref.connectionId, schema: ref.schema, table: ref.table }
        : null;
};

const tabOf = (value: unknown): WorkbenchTab | null => {
    const raw = value as Record<string, unknown> | null;
    if (typeof raw !== 'object' || raw === null || !isText(raw.id)) {
        return null;
    }
    const id = raw.id;
    switch (raw.kind) {
        case 'table': {
            const ref = refOf(raw.ref);
            const view = raw.view === 'structure' ? 'structure' : 'data';
            return ref === null || !isOptionalText(raw.where) ? null : { id, kind: 'table', ref, view, where: raw.where };
        }
        case 'console':
            return isText(raw.connectionId) && isOptionalText(raw.schema) && typeof raw.sql === 'string' && typeof raw.number === 'number'
                ? { id, kind: 'console', connectionId: raw.connectionId, schema: raw.schema, sql: raw.sql, number: raw.number }
                : null;
        case 'designer':
            return isText(raw.connectionId) && isText(raw.schema) && isOptionalText(raw.table)
                ? { id, kind: 'designer', connectionId: raw.connectionId, schema: raw.schema, table: raw.table }
                : null;
        default:
            return null;
    }
};

/* What a past run stored, or an empty workbench for anything that is missing or not ours. A tab that is not valid is left out, the rest stays. */
export const parseState = (raw: string | null): WorkbenchState => {
    if (raw === null) {
        return emptyState;
    }
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return emptyState;
    }
    if (typeof data !== 'object' || data === null || data.version !== 1 || !Array.isArray(data.tabs)) {
        return emptyState;
    }
    const seen = new Set<string>();
    const tabs = data.tabs.map(tabOf).filter((tab): tab is WorkbenchTab => {
        if (tab === null || seen.has(tab.id)) {
            return false;
        }
        seen.add(tab.id);
        return true;
    });
    const activeId = typeof data.activeId === 'string' && seen.has(data.activeId) ? data.activeId : (tabs.at(-1)?.id ?? null);
    const counter = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);
    return {
        tabs,
        activeId,
        serial: Math.max(counter(data.serial), ...tabs.map((tab) => Number(/^(?:filtered|console|designer):(\d+)$/.exec(tab.id)?.[1] ?? 0))),
        consoles: Math.max(counter(data.consoles), ...tabs.map((tab) => (tab.kind === 'console' ? tab.number : 0)))
    };
};
