import type { ChartAccessor, ChartX, ChartXInput } from './types.ts';

declare const process: { env: { NODE_ENV?: string } } | undefined;

export function readValue<Row, Value>(accessor: ChartAccessor<Row, Value>, row: Row, index: number): Value {
    return typeof accessor === 'function' ? accessor(row, index) : (row[accessor] as Value);
}

/* A moment becomes its milliseconds, so every x compares as a number or as a key. */
export function xOf(value: ChartXInput): ChartX {
    return value instanceof Date ? value.getTime() : value;
}

/* A value that is no finite number, such as a missing one, breaks a line instead of drawing a zero. */
export function numberOf(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const warned = new Set<string>();

/* Says a message once, outside production. */
export function warnOnce(message: string): void {
    if ((typeof process !== 'undefined' && process.env.NODE_ENV === 'production') || warned.has(message)) {
        return;
    }

    warned.add(message);
    console.warn(message);
}

/* Says that a key names nothing in the data, which the plain `Chart` cannot check by type. */
export function warnMissingKey(accessor: unknown, data: readonly unknown[], part: string): void {
    if (typeof accessor !== 'string' || data.length === 0) {
        return;
    }

    const first = data[0];

    if (typeof first === 'object' && first !== null && !(accessor in first)) {
        warnOnce(`${part}: the rows have no key "${accessor}".`);
    }
}
