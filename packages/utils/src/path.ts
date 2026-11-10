import { isAbsolute, relative, sep } from 'node:path';

/*
 * Where one path lies against another, compared as text after `path.relative` resolved and normalized
 * both, with the platform's separator, drive letters and case rules. Nothing here reads the disk, so a
 * symbolic link inside the folder still counts as inside: a caller that serves or writes a file checks
 * its real path or holds a handle on it.
 */

/* Whether a path `relative` gave leaves the folder it was taken from; a name such as `..cache` does not. */
export function climbsOut(rel: string): boolean {
    return rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

export function isWithin(folder: string, path: string): boolean {
    return !climbsOut(relative(folder, path));
}

/* Whether `path` lies below `folder`, the folder itself not counted. */
export function isBelow(folder: string, path: string): boolean {
    const rel = relative(folder, path);

    return rel !== '' && !climbsOut(rel);
}
