import { randomUUID } from 'node:crypto';
import { closeSync, openSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { lstat, open, rename, rm, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { wait } from './async.ts';
import { hasErrorCode } from './errors.ts';

// Windows can refuse a rename while a watcher or an indexer holds the target; a few short retries cover it.
const RENAME_RETRIES = 5;
const RENAME_RETRY_MS = 40;

// Node has no synchronous sleep; a wait on a value nobody changes is one.
function sleepSync(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/* Whether a rename failed because another process holds the file open for a moment, as Windows reports it. */
export function isBusyRename(e: unknown): boolean {
    return hasErrorCode(e, 'EPERM', 'EBUSY', 'EACCES');
}

/* A temporary name is still opened exclusively: an unpredictable name alone cannot protect a write. */
export function tempNameFor(target: string): string {
    return `${target}.${process.pid}-${randomUUID()}.tmp`;
}

export interface WriteAtomicOptions {
    /* Flushed to the disk before and after the rename, for a file whose loss costs a person their work. */
    durable?: boolean;
}

async function createTemp(target: string, mode: number) {
    for (let attempt = 0; ; attempt++) {
        const path = tempNameFor(target);

        try {
            return { path, handle: await open(path, 'wx', mode) };
        } catch (error) {
            if (!hasErrorCode(error, 'EEXIST') || attempt >= 31) {
                throw error;
            }
        }
    }
}

// Windows cannot open a directory to flush it, and NTFS journals the rename itself.
export async function syncDirectory(path: string): Promise<void> {
    if (process.platform === 'win32') {
        return;
    }

    const handle = await open(path, 'r');

    try {
        await handle.sync();
    } finally {
        await handle.close();
    }
}

/*
 * A crash between the two steps leaves a stray temp file, never a half-written file. That holds for
 * a process that dies; after a power cut APFS and ext4 can still hold an empty target, unless the
 * write is durable.
 */
export async function writeAtomic(target: string, content: string | Uint8Array, mode = 0o600, options: WriteAtomicOptions = {}): Promise<void> {
    const { path: temp, handle } = await createTemp(target, mode);

    try {
        try {
            await handle.writeFile(content);

            if (options.durable) {
                await handle.sync();
            }
        } finally {
            await handle.close();
        }

        for (let attempt = 0; ; attempt++) {
            try {
                await rename(temp, target);

                break;
            } catch (e) {
                if (!isBusyRename(e) || attempt >= RENAME_RETRIES) {
                    throw e;
                }

                await wait(RENAME_RETRY_MS);
            }
        }

        if (options.durable) {
            await syncDirectory(dirname(target));
        }
    } finally {
        await rm(temp, { force: true });
    }
}

/*
 * The same rename, without a turn of the event loop. A `bun --watch` reload restarts a module before
 * an awaited write comes back, and an exit path is gone before one lands, so what has to be on disk
 * before the process turns around goes through here.
 */
export function replaceSync(temp: string, target: string, rename: (from: string, to: string) => void = renameSync): void {
    for (let attempt = 0; ; attempt++) {
        try {
            rename(temp, target);

            return;
        } catch (e) {
            if (!isBusyRename(e) || attempt >= RENAME_RETRIES) {
                throw e;
            }

            sleepSync(RENAME_RETRY_MS);
        }
    }
}

export function writeAtomicSync(target: string, content: string | Uint8Array, mode = 0o600): void {
    for (let attempt = 0; ; attempt++) {
        const temp = tempNameFor(target);
        let descriptor: number;

        try {
            descriptor = openSync(temp, 'wx', mode);
        } catch (error) {
            if (hasErrorCode(error, 'EEXIST') && attempt < 31) {
                continue;
            }

            throw error;
        }

        try {
            try {
                writeFileSync(descriptor, content);
            } finally {
                closeSync(descriptor);
            }

            replaceSync(temp, target);

            return;
        } finally {
            rmSync(temp, { force: true });
        }
    }
}

// Bun on Windows fails a forced rm with EFAULT while another delete of the same file is pending; it goes either way.
export async function removeFile(path: string, remove: (path: string, options: { force: true }) => Promise<void> = rm): Promise<void> {
    try {
        await remove(path, { force: true });
    } catch (e) {
        if (!hasErrorCode(e, 'EFAULT')) {
            throw e;
        }
    }
}

export async function fileExists(path: string): Promise<boolean> {
    try {
        await stat(path);

        return true;
    } catch {
        return false;
    }
}

/* Whether anything is at the path, a link that leads nowhere included, where `fileExists` follows the link. */
export async function entryExists(path: string): Promise<boolean> {
    try {
        await lstat(path);

        return true;
    } catch {
        return false;
    }
}
