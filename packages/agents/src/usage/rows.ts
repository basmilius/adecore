import type { UsageProvider } from '@adecore/agent-contracts';
import type { UsageRecord } from './record.ts';

/* Interned names keep the files compact; optional cost and tier fields preserve per-call pricing. */
export type RecordRow = [number, number, number, number, number, number, number, number, number, number, number, string | 0, number?, number?, string?];

/* The names the rows of one document point into. */
export interface RowTables {
    models: string[];
    sessions: string[];
    folders: string[];
    accounts: string[];
}

class Interner {
    readonly values: string[] = [];
    private readonly at = new Map<string, number>();

    index(value: string): number {
        const seen = this.at.get(value);

        if (seen !== undefined) {
            return seen;
        }

        const next = this.values.length;
        this.values.push(value);
        this.at.set(value, next);

        return next;
    }
}

/* Turns records into rows, collecting the names they share into one set of tables. */
export class RowWriter {
    private readonly models = new Interner();
    private readonly sessions = new Interner();
    private readonly folders = new Interner();
    private readonly accounts = new Interner();

    get tables(): RowTables {
        return { models: this.models.values, sessions: this.sessions.values, folders: this.folders.values, accounts: this.accounts.values };
    }

    row(record: UsageRecord): RecordRow {
        const counted: RecordRow = [
            record.timestampMs,
            this.models.index(record.model),
            this.sessions.index(record.sessionId),
            this.folders.index(record.cwd),
            record.totals.calls,
            record.totals.input,
            record.totals.cacheRead,
            record.totals.cacheWrite,
            record.totals.cacheWrite1h,
            record.totals.output,
            record.totals.reasoning,
            record.dedupeKey ?? 0,
            record.account === undefined ? 0 : this.accounts.index(record.account) + 1
        ];

        if (record.costUsd !== undefined || record.serviceTier !== undefined) {
            counted[13] = record.costUsd;
        }

        if (record.serviceTier !== undefined) {
            counted[14] = record.serviceTier;
        }

        return counted;
    }
}

/* Rows written before accounts carry twelve fields, and before per-call pricing at most fourteen. */
export interface RowShape {
    accountless: boolean;
    maxLength: number;
}

export const CURRENT_ROW: RowShape = { accountless: false, maxLength: 15 };

function isRow(row: unknown, shape: RowShape): row is RecordRow {
    return (
        Array.isArray(row) &&
        (shape.accountless ? row.length === 12 : row.length >= 13 && row.length <= shape.maxLength) &&
        row.slice(0, 11).every((value) => typeof value === 'number') &&
        (typeof row[11] === 'string' || row[11] === 0) &&
        (shape.accountless || typeof row[12] === 'number') &&
        (row.length < 14 || row[13] === null || row[13] === undefined || typeof row[13] === 'number') &&
        (row.length < 15 || typeof row[14] === 'string')
    );
}

function nameAt(table: unknown, at: number): string | null {
    return Array.isArray(table) && typeof table[at] === 'string' ? table[at] : null;
}

/* The records of `rows`, or null when any row does not read back against its tables. */
export function decodeRows(rows: unknown, tables: Partial<Record<keyof RowTables, unknown>>, provider: UsageProvider, shape: RowShape): UsageRecord[] | null {
    if (!Array.isArray(rows)) {
        return null;
    }

    const records: UsageRecord[] = [];

    for (const row of rows) {
        if (!isRow(row, shape)) {
            return null;
        }

        const model = nameAt(tables.models, row[1]);
        const sessionId = nameAt(tables.sessions, row[2]);
        const cwd = nameAt(tables.folders, row[3]);
        const accountAt = row[12] ?? 0;
        const account = accountAt === 0 ? undefined : nameAt(tables.accounts, accountAt - 1);

        if (model === null || sessionId === null || cwd === null || account === null) {
            return null;
        }

        records.push({
            provider,
            timestampMs: row[0],
            model,
            sessionId,
            cwd,
            ...(account === undefined ? {} : { account }),
            totals: { calls: row[4], input: row[5], cacheRead: row[6], cacheWrite: row[7], cacheWrite1h: row[8], output: row[9], reasoning: row[10] },
            ...(typeof row[13] === 'number' ? { costUsd: row[13] } : {}),
            ...(typeof row[14] === 'string' ? { serviceTier: row[14] } : {}),
            dedupeKey: row[11] === 0 ? null : row[11]
        });
    }

    return records;
}
