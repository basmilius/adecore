export const sameList = (left: readonly string[], right: readonly string[]): boolean =>
    left.length === right.length && left.every((item, index) => item === right[index]);
