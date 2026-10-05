import { createContext, use } from 'react';
import type { DatabaseAction, DatabaseFiles, DatabaseStorage } from './actions.ts';
import type { DatabaseClient } from './client/types.ts';

export interface DatabaseContextValue {
    readonly client: DatabaseClient;
    readonly onAction: ((action: DatabaseAction) => void) | undefined;
    readonly storage: DatabaseStorage | undefined;
    readonly files: DatabaseFiles | undefined;
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

export const useDatabaseStorage = (): DatabaseStorage | undefined => useDatabaseContext().storage;

/* The app's file dialogs; export and import stay hidden without them. */
export const useDatabaseFiles = (): DatabaseFiles | undefined => useDatabaseContext().files;
