import { createContext, use } from 'react';
import type { DatabaseAction, DatabaseFiles, DatabaseNotice, DatabaseStorage } from './actions.ts';
import type { DatabaseClient } from './client/types.ts';
import type { NumberNotation } from './grid/display.ts';

export interface DatabaseContextValue {
    readonly client: DatabaseClient;
    readonly onAction: ((action: DatabaseAction) => void) | undefined;
    readonly onNotice: ((notice: DatabaseNotice) => void) | undefined;
    readonly storage: DatabaseStorage | undefined;
    readonly files: DatabaseFiles | undefined;
    readonly numberNotation: NumberNotation;
}

export const DatabaseContext = createContext<DatabaseContextValue | null>(null);

const useDatabaseContext = (): DatabaseContextValue => {
    const value = use(DatabaseContext);
    if (value === null) {
        throw new Error('A database view needs a DatabaseProvider above it.');
    }
    return value;
};

export const useDatabaseClient = (): DatabaseClient => useDatabaseContext().client;

/* Hands an action to the app, or `undefined` when the app takes none, so a view can leave out what would go nowhere. */
export const useDatabaseAction = (): ((action: DatabaseAction) => void) | undefined => useDatabaseContext().onAction;

/* Hands a notice to the app, or `undefined` when the app takes none and the view shows it itself. */
export const useDatabaseNotice = (): ((notice: DatabaseNotice) => void) | undefined => useDatabaseContext().onNotice;

export const useDatabaseStorage = (): DatabaseStorage | undefined => useDatabaseContext().storage;

/* The app's file dialogs; export and import stay hidden without them. */
export const useDatabaseFiles = (): DatabaseFiles | undefined => useDatabaseContext().files;

/* Read without the guard of the other hooks: a grid drawn on its own, such as in a test, writes numbers as the database does. */
export const useNumberNotation = (): NumberNotation => use(DatabaseContext)?.numberNotation ?? 'database';
