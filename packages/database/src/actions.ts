import type { TableRef } from './client/types.ts';
import type { TableKind } from './protocol/index.ts';

/*
 * Something a view asks the app to open. The views draw no tabs and no windows of their own: the app
 * decides where a table, a console or the designer lands, such as a tab beside its file tabs.
 */
export type DatabaseAction =
    | {
          readonly kind: 'open-table';
          readonly ref: TableRef;
          readonly view: 'data' | 'structure';
          /* Opens the table filtered, as a jump along a foreign key does. */
          readonly where?: string;
          /* Whether `ref` is a table or a view, where the sender knows it. */
          readonly tableKind?: TableKind;
          /*
           * Only from an explorer that opens on a click: `true` for that click, a look a person may move on from, and
           * `false` for a double click or Enter, which mean to keep the table open.
           */
          readonly preview?: boolean;
      }
    | { readonly kind: 'open-console'; readonly connectionId: string; readonly schema?: string; readonly sql?: string }
    | { readonly kind: 'new-table'; readonly connectionId: string; readonly schema: string }
    | { readonly kind: 'edit-table'; readonly ref: TableRef }
    /* The app opens its connection manager on this connection. */
    | { readonly kind: 'manage-connection'; readonly connectionId: string };

/*
 * Something a view tells a person that passes, such as an export that finished or failed, for the app to show
 * where it shows such news. What stays part of a view, such as a conflict or a read-only reason, is no notice.
 */
export interface DatabaseNotice {
    readonly tone: 'success' | 'error';
    /* What happened in a few words, such as "Exported 1,884 rows." or "Export failed". */
    readonly title: string;
    /* Why it failed, as the server or the file system said it. */
    readonly description?: string;
    readonly action?: { readonly label: string; run(): void };
}

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
