const GAP = 2;
/* The shortest column that still reads as a bar rather than a dot. */
const MIN_HEIGHT = 4;

export interface SparkColumn {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly radius: number;
    /* A zero, drawn as a one-pixel baseline without rounding. */
    readonly zero: boolean;
}

/* The columns of a sparkline on whole pixels, 2px apart, rounded by half their width; a zero keeps a one-pixel baseline. */
export function sparkColumns(values: readonly (number | null)[], width: number, height: number): SparkColumn[] {
    const high = Math.max(0, ...values.map((value) => value ?? 0));
    const step = values.length === 0 ? 0 : (width + GAP) / values.length;

    return values.flatMap((value, index) => {
        if (value === null) {
            return [];
        }

        const x = Math.round(index * step);
        const columnWidth = Math.max(1, Math.round((index + 1) * step) - x - GAP);
        const zero = value <= 0 || high === 0;
        const radius = zero ? 0 : columnWidth / 2;
        const columnHeight = zero ? 1 : Math.min(height, Math.max(MIN_HEIGHT, Math.round((value / high) * height)));

        return [{ x, y: height - columnHeight, width: columnWidth, height: columnHeight, radius, zero }];
    });
}
