import { randomUUID } from 'node:crypto';
import { access, rm } from 'node:fs/promises';
import type { DatabaseHost } from '@adecore/database/host';
import type { DatabaseMethod, DatabaseParams, DatabaseRequest, DatabaseResult } from '@adecore/database/protocol';
import { SEED_SQL } from './seed.ts';

const SEED_OWNER = 'demo-seed';

const call = async <M extends DatabaseMethod>(host: DatabaseHost, method: M, params: DatabaseParams<M>): Promise<DatabaseResult<M>> => {
    const request = { id: randomUUID(), method, params } as DatabaseRequest<M>;
    const response = await host.handle(request, SEED_OWNER);

    if (!response.ok) {
        throw new Error(`${method}: ${response.error.message}`);
    }

    return response.result as DatabaseResult<M>;
};

const exists = (path: string): Promise<boolean> =>
    access(path).then(
        () => true,
        () => false
    );

/* Creates the demo database through the host itself, so the app needs no SQLite library of its own. */
export const ensureDemoDatabase = async (host: DatabaseHost, path: string): Promise<void> => {
    if (await exists(path)) {
        return;
    }

    try {
        const { session } = await call(host, 'open', { connection: { engine: 'sqlite', path, create: true } });

        try {
            const { results } = await call(host, 'execute', { session, sql: SEED_SQL });
            const failed = results.find((result) => result.kind === 'error');

            if (failed?.kind === 'error') {
                throw new Error(`Seeding failed at "${failed.sql.slice(0, 60)}": ${failed.error.message}`);
            }
        } finally {
            await call(host, 'close', { session });
        }
    } catch (e) {
        // A half-seeded file would pass the exists check on the next start.
        await rm(path, { force: true });
        throw e;
    }
};
