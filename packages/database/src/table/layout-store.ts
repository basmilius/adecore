import type { GridLayout } from '../grid/column-layout.ts';
import type { StoredFilter } from './command-field.ts';
import { PAGE_SIZES } from './paging.ts';

/*
 * Bump when the shape changes; a stored value of another version is ignored rather than migrated. `filters`
 * came later without a bump, since `where` still says the same thing for a value without it.
 */
export const LAYOUT_VERSION = 1;

/* What is remembered of one table's view between visits. */
export interface StoredLayout extends GridLayout {
    readonly pageSize: number | null;
    readonly where: string;
    readonly orderBy: string;
    /* The filter chips as typed, which `where` alone would only give back as one raw condition. */
    readonly filters: readonly StoredFilter[];
}

export const EMPTY_LAYOUT: StoredLayout = { widths: {}, hidden: [], pinned: [], pageSize: null, where: '', orderBy: '', filters: [] };

export const layoutStorageKey = (connectionId: string, schema: string, table: string): string => `database:table:${connectionId}:${schema}.${table}`;

const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

const isStoredFilter = (value: unknown): value is StoredFilter =>
    isRecord(value) && typeof value.text === 'string' && typeof value.sql === 'string' && value.sql.trim() !== '';

export const serializeLayout = (layout: StoredLayout): string => JSON.stringify({ version: LAYOUT_VERSION, ...layout });

/* The layout a stored text holds, or `null` when it is missing, broken or from another version. A field that is off is dropped alone. */
export const parseStoredLayout = (text: string | null): StoredLayout | null => {
    if (text === null) {
        return null;
    }
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        return null;
    }
    if (!isRecord(data) || data.version !== LAYOUT_VERSION) {
        return null;
    }
    const widths: Record<string, number> = {};
    if (isRecord(data.widths)) {
        for (const [name, width] of Object.entries(data.widths)) {
            if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
                widths[name] = width;
            }
        }
    }
    const pageSize = PAGE_SIZES.find((size) => size === data.pageSize) ?? null;
    return {
        widths,
        hidden: isStringList(data.hidden) ? data.hidden : [],
        pinned: isStringList(data.pinned) ? data.pinned : [],
        pageSize,
        where: typeof data.where === 'string' ? data.where : '',
        orderBy: typeof data.orderBy === 'string' ? data.orderBy : '',
        filters: Array.isArray(data.filters) ? data.filters.filter(isStoredFilter).map((filter) => ({ text: filter.text, sql: filter.sql })) : []
    };
};
