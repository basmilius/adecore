import type { Ref } from 'react';

/* What a run takes: the selection, or the statement at the caret when nothing is selected; or the whole text. */
export type QueryConsoleRunScope = 'selection-or-statement' | 'all';

/* What the console asks the editor whenever it runs. */
export interface QueryConsoleEditorHandle {
    /* Offsets into the text, `start` equal to `end` for a caret. */
    selection(): { readonly start: number; readonly end: number };
}

/* What the console hands the editor it draws, its own or the app's. */
export interface QueryConsoleEditorProps {
    /* Where the editor puts its handle. Without one, a run of the selection or the statement runs the whole text. */
    ref: Ref<QueryConsoleEditorHandle>;
    value: string;
    onValueChange(sql: string): void;
    /* What the editor's own keys call, as the toolbar does. It reads the selection through the handle, and does nothing while `busy` or when there is nothing to run. */
    run(scope: QueryConsoleRunScope): void;
    /* A run or the end of a transaction is under way. */
    busy: boolean;
    /* The accessible name of the editor and its placeholder, in the person's language. */
    label: string;
    placeholder: string;
    /* The console was opened just now: the editor takes the caret once it is there. */
    autoFocus: boolean;
}
