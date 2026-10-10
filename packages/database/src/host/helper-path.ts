import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';

export interface HelperPathOptions {
    /* `process.platform` when left out. */
    readonly platform?: string;
    /* `process.arch` when left out. */
    readonly arch?: string;
    /* Resolves a package specifier to a file; the module resolution of this file when left out. */
    readonly resolve?: (specifier: string) => string;
    readonly exists?: (path: string) => boolean;
}

/*
 * Finds the prebuilt helper that npm installed for this machine, in the `@adecore/database-<platform>-<arch>`
 * package, or null when there is none: an unsupported platform, or an install with optional dependencies off.
 *
 * A binary cannot run from inside an Electron archive. The path is mapped from `app.asar` to
 * `app.asar.unpacked`, so the app must unpack the packages (electron-builder: `asarUnpack` with
 * `node_modules/@adecore/database-*` followed by `/**`).
 */
export const helperPath = ({
    platform = process.platform,
    arch = process.arch,
    resolve = (specifier) => createRequire(import.meta.url).resolve(specifier),
    exists = existsSync
}: HelperPathOptions = {}): string | null => {
    let manifest: string;

    try {
        manifest = resolve(`@adecore/database-${platform}-${arch}/package.json`);
    } catch {
        return null;
    }

    const binary = join(dirname(manifest), 'bin', platform === 'win32' ? 'adecore-database.exe' : 'adecore-database');
    const unpacked = binary.replace(`.asar${sep}`, `.asar.unpacked${sep}`);

    return exists(unpacked) ? unpacked : null;
};
