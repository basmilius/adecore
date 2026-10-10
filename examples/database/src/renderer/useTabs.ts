import { useRef, useState } from 'react';
import type { TableRef } from '@adecore/database';

export type TableViewMode = 'data' | 'structure';

export type WorkTab =
    | { readonly id: string; readonly kind: 'table'; readonly ref: TableRef; readonly view: TableViewMode; readonly where?: string }
    | {
          readonly id: string;
          readonly kind: 'console';
          readonly connectionId: string;
          readonly schema: string | undefined;
          readonly sql: string;
          readonly number: number;
      }
    | { readonly id: string; readonly kind: 'designer'; readonly connectionId: string; readonly schema: string; readonly table: string | undefined }
    | { readonly id: string; readonly kind: 'connections' };

interface Workspace {
    readonly tabs: readonly WorkTab[];
    readonly activeId: string | null;
}

export const CONNECTIONS_TAB = 'connections';

export function connectionIdOf(tab: WorkTab): string | null {
    switch (tab.kind) {
        case 'table':
            return tab.ref.connectionId;
        case 'console':
        case 'designer':
            return tab.connectionId;
        case 'connections':
            return null;
    }
}

function tableTabId(ref: TableRef): string {
    return `table:${ref.connectionId}\u0000${ref.schema}\u0000${ref.table}`;
}

/* The open tabs and the one in front. Opening something that is already open brings its tab forward. */
export function useTabs() {
    const [workspace, setWorkspace] = useState<Workspace>({ tabs: [], activeId: null });
    const serial = useRef(0);
    const consoles = useRef(0);

    const open = (tab: WorkTab): void => {
        setWorkspace((current) => ({
            tabs: current.tabs.some((existing) => existing.id === tab.id) ? current.tabs : [...current.tabs, tab],
            activeId: tab.id
        }));
    };

    /* A filtered table is a tab of its own: the filter is what was asked for. */
    const openTable = (ref: TableRef, view: TableViewMode = 'data', where?: string): void => {
        serial.current += 1;
        open({ id: where === undefined ? tableTabId(ref) : `filtered:${serial.current}`, kind: 'table', ref, view, where });
    };

    const openConsole = (connectionId: string, schema?: string, sql = ''): void => {
        consoles.current += 1;
        serial.current += 1;
        open({ id: `console:${serial.current}`, kind: 'console', connectionId, schema, sql, number: consoles.current });
    };

    const openDesigner = (connectionId: string, schema: string, table?: string): void => {
        serial.current += 1;
        open({
            id: table === undefined ? `designer:${serial.current}` : `designer:${connectionId}\u0000${schema}\u0000${table}`,
            kind: 'designer',
            connectionId,
            schema,
            table
        });
    };

    const openConnections = (): void => {
        open({ id: CONNECTIONS_TAB, kind: 'connections' });
    };

    const activate = (id: string): void => {
        setWorkspace((current) => ({ ...current, activeId: id }));
    };

    const close = (id: string): void => {
        setWorkspace((current) => {
            const at = current.tabs.findIndex((tab) => tab.id === id);
            const tabs = current.tabs.filter((tab) => tab.id !== id);
            const neighbor = tabs[Math.min(at, tabs.length - 1)];
            return { tabs, activeId: current.activeId === id ? (neighbor?.id ?? null) : current.activeId };
        });
    };

    const setView = (id: string, view: TableViewMode): void => {
        setWorkspace((current) => ({ ...current, tabs: current.tabs.map((tab) => (tab.id === id && tab.kind === 'table' ? { ...tab, view } : tab)) }));
    };

    /* Closes the tabs of connections that no longer exist. */
    const keepConnections = (ids: ReadonlySet<string>): void => {
        setWorkspace((current) => {
            const tabs = current.tabs.filter((tab) => {
                const connectionId = connectionIdOf(tab);
                return connectionId === null || ids.has(connectionId);
            });
            const activeId = tabs.some((tab) => tab.id === current.activeId) ? current.activeId : (tabs.at(-1)?.id ?? null);
            return tabs.length === current.tabs.length ? current : { tabs, activeId };
        });
    };

    return {
        tabs: workspace.tabs,
        activeId: workspace.activeId,
        openTable,
        openConsole,
        openDesigner,
        openConnections,
        activate,
        close,
        setView,
        keepConnections
    };
}
