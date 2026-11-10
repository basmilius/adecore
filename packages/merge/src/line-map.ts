import { diffLines, type Change } from './diff.ts';

/**
 * Where every line of `base` stands in `other`, or -1 for a line a change replaced or removed.
 * Pass the `changes` of `diffLines(base, other)` when the caller holds them already.
 */
export function lineMap(base: readonly string[], other: readonly string[], changes: readonly Change[] = diffLines(base, other)): Int32Array {
    const map = new Int32Array(base.length);
    let shift = 0;
    let index = 0;

    for (const change of changes) {
        for (; index < change.baseStart; index++) {
            map[index] = index + shift;
        }

        for (; index < change.baseEnd; index++) {
            map[index] = -1;
        }

        shift += change.otherEnd - change.otherStart - (change.baseEnd - change.baseStart);
    }

    for (; index < base.length; index++) {
        map[index] = index + shift;
    }

    return map;
}
