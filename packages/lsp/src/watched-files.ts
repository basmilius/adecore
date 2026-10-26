import { globMatch } from './glob.ts';
import type { FileSystemWatcher } from './protocol.ts';
import { fileUriToPath, isWindowsPath } from './uris.ts';

/* A change of a file as the protocol numbers it: created, changed, deleted. */
export type FileChangeType = 1 | 2 | 3;

const EVERY_CHANGE = 7;

/* Folders whose files a server hears about only when a pattern of its own names the folder. */
const SPARING_FOLDERS = ['node_modules', 'vendor', '.git'];

/* A Windows path with forward slashes and its drive in capitals, so it compares with a pattern and a root however it was written. A POSIX path is left alone, a backslash being part of a name there. */
function slashed(path: string): string {
    if (!isWindowsPath(path)) {
        return path;
    }
    const forward = path.replaceAll('\\', '/');
    return /^[a-z]:/.test(forward) ? `${forward[0]!.toUpperCase()}${forward.slice(1)}` : forward;
}

function relativeTo(root: string, path: string): string | null {
    const prefix = root.endsWith('/') ? root : `${root}/`;
    return path.startsWith(prefix) ? path.slice(prefix.length) : null;
}

/* A pattern with the folder it is relative to, or null for a relative pattern whose base is no folder of this machine. */
function patternOf(watcher: FileSystemWatcher): { base: string | undefined; pattern: string } | null {
    const { globPattern } = watcher;
    if (typeof globPattern === 'string') {
        return { base: undefined, pattern: globPattern };
    }
    const base = fileUriToPath(typeof globPattern.baseUri === 'string' ? globPattern.baseUri : globPattern.baseUri.uri);
    return base === null ? null : { base: slashed(base), pattern: globPattern.pattern };
}

/*
 * Whether a server asked to hear about this change. A string pattern is relative to the project folder
 * (or absolute), a relative pattern to its own base. A path inside `node_modules`, `vendor` or `.git` only
 * matches a pattern that names that folder, since `**` over a dependency tree is what a server never means.
 */
export function watchesFile(watchers: readonly FileSystemWatcher[], root: string, changed: string, type: FileChangeType): boolean {
    const path = slashed(changed);
    const inProject = relativeTo(slashed(root), path);
    const segments = (inProject ?? path).split('/');
    return watchers.some((watcher) => {
        if (((watcher.kind ?? EVERY_CHANGE) & (1 << (type - 1))) === 0) {
            return false;
        }
        const parts = patternOf(watcher);
        if (parts === null) {
            return false;
        }
        const { base, pattern } = parts;
        const subject = pattern.startsWith('/') || /^[A-Za-z]:\//.test(pattern) ? path : base === undefined ? inProject : relativeTo(base, path);
        if (subject === null || !globMatch(subject, pattern)) {
            return false;
        }
        return SPARING_FOLDERS.every((folder) => !segments.includes(folder) || pattern.includes(folder));
    });
}
