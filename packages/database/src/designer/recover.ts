import type { DatabaseSession } from '../client/types.ts';

const REBUILD_START = 'PRAGMA foreign_keys=OFF';

/*
 * A failed rebuild leaves SQLite with a transaction it began and foreign keys it switched off.
 * Only a transaction this script began is rolled back, since one the person had open is theirs.
 */
export async function recoverFrom(session: DatabaseSession, statements: readonly string[], failedSql: string, inTransaction: boolean): Promise<void> {
    try {
        if (inTransaction && statements.includes('BEGIN') && failedSql.trim().toUpperCase() !== 'BEGIN') {
            await session.transaction('rollback');
        }
        if (statements[0] === REBUILD_START) {
            await session.execute('PRAGMA foreign_keys=ON');
        }
    } catch {
        // The error of the statement that failed is the one worth showing.
    }
}
