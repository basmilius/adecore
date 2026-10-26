/* The space between two groups of columns, wide enough to read as a break and not as a missing column. */
export const GROUP_GAP = 16;

/* A column wider than this reads as a block rather than as a value. */
const MAX_COLUMN = 56;

/* Share of a bucket a column takes when it is alone in it; the rest is air between buckets. */
const COLUMN_SHARE = 0.72;

export interface BandGroup {
    readonly key: string;
    readonly first: number;
    readonly last: number;
    readonly left: number;
    readonly right: number;
}

export interface BandLayout {
    readonly bucket: number;
    /* The width the buckets take, wider than the room when `minBucketWidth` does not fit. */
    readonly width: number;
    /* The left edge of every bucket, from the left of the plot, unrounded. */
    readonly lefts: readonly number[];
    /* Empty without a `group`. */
    readonly groups: readonly BandGroup[];
    /* The pixels between two groups, 0 without groups. */
    readonly gap: number;
}

/* The run of equal keys each bucket belongs to, in the order of the data; a key that comes back later starts a run of its own. */
export function groupRuns(keys: readonly string[]): { key: string; first: number; last: number }[] {
    const runs: { key: string; first: number; last: number }[] = [];

    keys.forEach((key, index) => {
        const run = runs.at(-1);

        if (run !== undefined && run.key === key) {
            run.last = index;
        } else {
            runs.push({ key, first: index, last: index });
        }
    });

    return runs;
}

/*
 * The buckets of a band scale across the room, no narrower than `minBucketWidth`. Groups get a gap between them and
 * half of one at both ends, so the first and the last group stand as far from the edge as from their neighbors.
 */
export function bandLayout(count: number, groupKeys: readonly string[] | null, room: number, minBucketWidth = 0, groupGap = GROUP_GAP): BandLayout {
    const runs = groupKeys === null ? [] : groupRuns(groupKeys);
    const gaps = runs.length * groupGap;

    if (count === 0) {
        return { bucket: 0, width: Math.max(0, room), lefts: [], groups: [], gap: 0 };
    }

    const bucket = Math.max(minBucketWidth, (room - gaps) / count);
    const width = Math.max(room, bucket * count + gaps);
    const lefts: number[] = [];
    const groups: BandGroup[] = [];

    if (runs.length === 0) {
        for (let i = 0; i < count; i++) {
            lefts.push(i * bucket);
        }

        return { bucket, width, lefts, groups, gap: 0 };
    }

    runs.forEach((run, groupIndex) => {
        for (let i = run.first; i <= run.last; i++) {
            lefts.push(i * bucket + (groupIndex + 0.5) * groupGap);
        }

        groups.push({ ...run, left: lefts[run.first]!, right: lefts[run.last]! + bucket });
    });

    return { bucket, width, lefts, groups, gap: groupGap };
}

export interface Column {
    readonly x: number;
    readonly width: number;
}

/*
 * The columns side by side in one bucket, on whole pixels: never narrower than 2px, with 1px between
 * neighbors, and at least 1px of air to the next bucket when the bucket has room for it. `widthOf` gives the width
 * the columns of a bucket take together instead, at most the bucket.
 */
export function columnsIn(left: number, bucket: number, count: number, widthOf?: (bucket: number) => number): Column[] {
    if (count <= 0) {
        return [];
    }

    const room =
        widthOf !== undefined ? Math.min(bucket, widthOf(bucket)) : Math.min(bucket - Math.max(1, bucket * (1 - COLUMN_SHARE)), MAX_COLUMN * count + count - 1);

    const width = Math.max(2, Math.floor((room - (count - 1)) / count));
    const total = width * count + count - 1;
    const start = Math.round(left + (bucket - total) / 2);

    return Array.from({ length: count }, (_, i) => ({ x: start + i * (width + 1), width }));
}

/*
 * The rectangle of one value of a column, from its base to its top in pixels. A segment stacked on
 * another leaves 1px of the ground between them, and a value that is not zero never vanishes. `least` gives every
 * value, zero too, that many pixels away from its base.
 */
export function segmentOf(topPixel: number, basePixel: number, onGround: boolean, value: number, least = 0): { y: number; height: number } {
    const upward = topPixel <= basePixel;
    let top = Math.round(Math.min(topPixel, basePixel));
    let bottom = Math.round(Math.max(topPixel, basePixel));

    if (!onGround && upward) {
        bottom -= 1;
    } else if (!onGround) {
        top += 1;
    }

    if (least > 0 && bottom - top < least) {
        return upward ? { y: bottom - least, height: least } : { y: top, height: least };
    }

    if (value !== 0 && bottom - top < 1) {
        return upward ? { y: bottom - 1, height: 1 } : { y: top, height: 1 };
    }

    return { y: top, height: Math.max(0, bottom - top) };
}

/* The outline of a column rounded only at its end away from the ground: the top for a value upward, else the bottom. */
export function endRoundedColumn(x: number, y: number, width: number, height: number, radius: number, upward: boolean): string {
    const corner = Math.max(0, Math.min(radius, height, width / 2));

    if (upward) {
        return `M${x},${y + height}V${y + corner}A${corner},${corner} 0 0 1 ${x + corner},${y}H${x + width - corner}A${corner},${corner} 0 0 1 ${x + width},${y + corner}V${y + height}Z`;
    }

    return `M${x},${y}H${x + width}V${y + height - corner}A${corner},${corner} 0 0 1 ${x + width - corner},${y + height}H${x + corner}A${corner},${corner} 0 0 1 ${x},${y + height - corner}Z`;
}

/* Between the top of a column and the baseline of its value. */
export const LABEL_LIFT = 10;
/* The height of a row of labels and what a label is taken to measure per character until it has been drawn once, per size. */
const LABEL_SIZES = { '2xs': { row: 16, char: 8 }, xs: { row: 18, char: 9 } } as const;

export type ValueLabelSize = keyof typeof LABEL_SIZES;

const LABEL_AIR = 3;

/* The width a value label is taken to have before it is measured. */
export const guessLabelWidth = (text: string, size: ValueLabelSize = '2xs'): number => text.length * LABEL_SIZES[size].char;

/*
 * The baseline of each column's value label: just over its column, or over every label in the way, in the order of the
 * columns. A label's width depends on its text only, so measuring it never feeds back into where the labels go.
 */
export function placeValueLabels(columns: readonly { center: number; top: number; width: number }[], size: ValueLabelSize = '2xs'): number[] {
    const row = LABEL_SIZES[size].row;
    const boxes: { left: number; right: number; top: number; bottom: number }[] = [];

    return columns.map(({ center, top, width }) => {
        const half = width / 2;
        let baseline = top - LABEL_LIFT;

        const blocking = () =>
            boxes.find(
                (box) =>
                    box.left < center + half + LABEL_AIR &&
                    box.right > center - half - LABEL_AIR &&
                    box.top < baseline + LABEL_AIR &&
                    box.bottom > baseline - row
            );

        for (let box = blocking(); box !== undefined; box = blocking()) {
            baseline = box.top - LABEL_AIR;
        }

        boxes.push({ left: center - half, right: center + half, top: baseline - row, bottom: baseline + LABEL_AIR });

        return baseline;
    });
}
