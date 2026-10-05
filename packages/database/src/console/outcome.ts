import type { Engine, StatementResult } from '../protocol/index.ts';
import { firstKeyword } from '../sql-split.ts';

/* How a run ended, for the history: whether every statement worked, and how many rows they read or changed. */
export const outcomeOf = (results: readonly StatementResult[]): { readonly ok: boolean; readonly rows: number } => ({
    ok: results.every((result) => result.kind !== 'error'),
    rows: results.reduce((sum, result) => sum + (result.kind === 'rows' ? result.rows.length : result.kind === 'done' ? result.affected : 0), 0)
});

/* Whether the helper can wrap the statement to fetch a page of it: a read that starts with `SELECT` or `WITH`. */
export const isPageable = (sql: string, engine: Engine): boolean => {
    const keyword = firstKeyword(sql, engine);
    return keyword === 'SELECT' || keyword === 'WITH';
};
