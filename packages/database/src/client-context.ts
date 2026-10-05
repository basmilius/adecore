import { createContext, use } from 'react';
import type { DatabaseClient } from './client/types.ts';

export const ClientContext = createContext<DatabaseClient | null>(null);

export const useDatabaseClient = (): DatabaseClient => {
    const client = use(ClientContext);
    if (client === null) {
        throw new Error('A database view needs a DatabaseProvider above it.');
    }
    return client;
};
