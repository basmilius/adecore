import type { Stats } from 'node:fs';
import { copyFile, mkdir, rmdir, stat, symlink, unlink, utimes } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { isNotFound } from '@adecore/utils/errors';
import { existing } from './shadow-home.ts';

/*
 * Links the person's own setup from the CLI's folder `from` into an account's folder `into`, for a CLI whose accounts
 * run apart from its own folder (`ProviderApart.links`). A link to an entry `from` no longer has is removed, since the
 * CLI makes the entry itself and fails on a dangling link. Answers the entries left alone because content is in the way.
 */
export async function linkApartEntries(from: string, into: string, names: readonly string[], platform: NodeJS.Platform = process.platform): Promise<string[]> {
    const shared = resolve(from);
    const own = resolve(into);
    const unshared: string[] = [];

    if (shared === own) {
        return unshared;
    }

    for (const name of names) {
        const target = join(shared, name);
        const link = join(own, name);
        const found = await existing(link);
        const source = await statOrNull(target);

        if (source === null) {
            if (found.kind === 'link') {
                await unlink(link);
            }

            continue;
        }

        if (found.kind === 'link' && resolve(dirname(link), found.target) === target) {
            continue;
        }

        // A file link on Windows needs elevation, so a file is copied there; a directory link there is a junction.
        if (platform === 'win32' && !source.isDirectory()) {
            if (!(await copiedFile(target, source, link, found.kind))) {
                unshared.push(name);
            }

            continue;
        }

        if (found.kind === 'link') {
            await unlink(link);
        } else if (found.kind === 'real' && !(await removedEmptyFolder(link))) {
            unshared.push(name);

            continue;
        }

        await mkdir(dirname(link), { recursive: true });
        await symlink(target, link, source.isDirectory() ? 'junction' : 'file');
    }

    return unshared;
}

/*
 * A copy carries the time of the file it was taken from, so a copy older than that file is refreshed and one edited
 * since it was taken is newer and stays. Answers false when content of the account's own is in the way.
 */
async function copiedFile(target: string, source: Stats, copy: string, found: 'missing' | 'link' | 'real'): Promise<boolean> {
    if (found === 'link') {
        await unlink(copy);
    } else if (found === 'real') {
        const own = await stat(copy);
        // Whole milliseconds, since a file system keeps a time it is given at a precision of its own.
        const ownTime = Math.floor(own.mtimeMs);
        const sourceTime = Math.floor(source.mtimeMs);

        if (!own.isFile() || ownTime > sourceTime) {
            return false;
        }

        if (ownTime === sourceTime) {
            return true;
        }
    }

    await mkdir(dirname(copy), { recursive: true });
    await copyFile(target, copy);
    await utimes(copy, source.atime, source.mtime);

    return true;
}

async function statOrNull(path: string): Promise<Stats | null> {
    try {
        return await stat(path);
    } catch (e) {
        if (isNotFound(e)) {
            return null;
        }

        throw e;
    }
}

/* The CLI leaves an empty folder where a link was missing; one with content, or a file, is the account's own and stays. */
async function removedEmptyFolder(path: string): Promise<boolean> {
    try {
        await rmdir(path);

        return true;
    } catch {
        return false;
    }
}
