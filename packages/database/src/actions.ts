import type { TableRef } from './client/types.ts';

/*
 * Something a view asks the app to open. The views draw no tabs and no windows of their own: the app
 * decides where a table, a console or the designer lands, such as a tab beside its file tabs.
 */
export type DatabaseAction =
    /* `where` opens the table filtered, as a jump along a foreign key does. */
    | { readonly kind: 'open-table'; readonly ref: TableRef; readonly view: 'data' | 'structure'; readonly where?: string }
    | { readonly kind: 'open-console'; readonly connectionId: string; readonly schema?: string; readonly sql?: string }
    | { readonly kind: 'new-table'; readonly connectionId: string; readonly schema: string }
    | { readonly kind: 'edit-table'; readonly ref: TableRef }
    /* The app opens its connection manager on this connection. */
    | { readonly kind: 'manage-connection'; readonly connectionId: string };

/* What is selected in the explorer: a connection, a schema in it, or a table in that schema. */
export interface ExplorerSelection {
    readonly connectionId: string;
    readonly schema?: string;
    readonly table?: string;
}

/* Where the views keep what a person set (console history, column widths, filters) across a remount. Synchronous, like `localStorage`. */
export interface DatabaseStorage {
    get(key: string): string | null;
    /* `null` removes the key. */
    set(key: string, value: string | null): void;
}

/* The app's file dialogs, for export and import. Each resolves the chosen absolute path, or `null` when the person cancelled. */
export interface DatabaseFiles {
    save(options: { readonly suggestedName: string; readonly format: 'csv' | 'tsv' | 'json' | 'sql' }): Promise<string | null>;
    open(options: { readonly formats: readonly ('csv' | 'tsv')[] }): Promise<string | null>;
}
