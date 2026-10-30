/*
 * The order the shell sorts the release list in has to be the order the page reads it in, or the
 * notes of a version land under the wrong heading. One comparison, so the two cannot disagree.
 */

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const NUMERIC = /^\d+$/;

/* A `1.2.3` or `1.2.3-beta.1`. A git tag carries a `v` in front of it, which is the tag's and not the version's. */
export const isVersion = (version: string): boolean => SEMVER.test(version);

/* Semver's order: part by part, numbers by value and below words, and a shorter list below a longer one it starts. */
const comparePrereleases = (a: string, b: string): number => {
    const left = a.split('.');
    const right = b.split('.');

    for (let i = 0; i < Math.min(left.length, right.length); i++) {
        const leftPart = left[i]!;
        const rightPart = right[i]!;
        const leftNumeric = NUMERIC.test(leftPart);
        const rightNumeric = NUMERIC.test(rightPart);

        if (leftNumeric !== rightNumeric) {
            return leftNumeric ? -1 : 1;
        }

        const difference = leftNumeric ? Number(leftPart) - Number(rightPart) : leftPart < rightPart ? -1 : leftPart > rightPart ? 1 : 0;

        if (difference !== 0) {
            return difference;
        }
    }

    return left.length - right.length;
};

/* Negative when `a` is older than `b`, a prerelease coming before its own release. A version that is not semver sorts below every one that is. */
export const compareVersions = (a: string, b: string): number => {
    const left = SEMVER.exec(a);
    const right = SEMVER.exec(b);

    if (!left || !right) {
        return (left ? 1 : 0) - (right ? 1 : 0);
    }

    for (let i = 1; i <= 3; i++) {
        const difference = Number(left[i]) - Number(right[i]);

        if (difference !== 0) {
            return difference;
        }
    }

    const leftPrerelease = left[4];
    const rightPrerelease = right[4];

    if (leftPrerelease === undefined || rightPrerelease === undefined) {
        return (leftPrerelease === undefined ? 1 : 0) - (rightPrerelease === undefined ? 1 : 0);
    }

    return comparePrereleases(leftPrerelease, rightPrerelease);
};
