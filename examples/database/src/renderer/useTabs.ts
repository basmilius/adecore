import { useRef, useState } from 'react';
import type { TableRef } from '@adecore/database';

export type TableViewMode = 'data' | 'structure';

export type WorkTab =
    | { readonly id: string; readonly kind: 'table'; readonly ref: TableRef; readonly view: TableViewMode }
    | { readonly id: string; readonly kind: 'console'; readonly connectionId: string; readonly schema: string | undefined; readonly number: number }
    | { readonly id: string; readonly kind: 'connections' };

interface Workspace {
    readonly tabs: readonly WorkTab[];
    readonly activeId: string | null;
}

export const CONNECTIONS_TAB = 'connections';

export const connectionIdOf = (tab: WorkTab): string | null => {
    switch (tab.kind) {
        case 'table':
            return tab.ref.connectionId;
        case 'console':
            return tab.connectionId;
        case 'connections':
            return null;
    }
};

const tableTabId = (ref: TableRef): string => `table:${ref.connectionId}\u0000${ref.schema}\u0000${ref.table}`;

/* The open tabs and the one in front. Opening something that is already open brings its tab forward. */
export const useTabs = () => {
    const [workspace, setWorkspace] = useState<Workspace>({ tabs: [], activeId: null });
    const consoles = useRef(0);

    const open = (tab: WorkTab): void => {
        setWorkspace((current) => ({
            tabs: current.tabs.some((existing) => existing.id === tab.id) ? current.tabs : [...current.tabs, tab],
            activeId: tab.id
        }));
    };

    const openTable = (ref: TableRef): void => {
        open({ id: tableTabId(ref), kind: 'table', ref, view: 'data' });
    };

    const openConsole = (connectionId: string, schema?: string): void => {
        consoles.current += 1;
        open({ id: `console:${consoles.current}`, kind: 'console', connectionId, schema, number: consoles.current });
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

    return { tabs: workspace.tabs, activeId: workspace.activeId, openTable, openConsole, openConnections, activate, close, setView, keepConnections };
};
