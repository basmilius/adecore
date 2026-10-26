function isWindowsDrive(segment: string): boolean {
    return /^[A-Za-z]:$/.test(segment);
}

/* A path with a drive or a UNC share. A backslash separates only in such a path; in a POSIX one it is part of a name. */
export function isWindowsPath(path: string): boolean {
    return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\');
}

/* An absolute path, POSIX, with a Windows drive or UNC, as the `file:` URI a language server names it by. */
export function pathToFileUri(path: string): string {
    const windows = isWindowsPath(path);
    const normalized = windows ? path.replaceAll('\\', '/') : path;

    if (windows && normalized.startsWith('//')) {
        const [host = '', ...segments] = normalized.slice(2).split('/');

        return `file://${encodeURIComponent(host)}/${segments.map(encodeURIComponent).join('/')}`;
    }

    const rooted = normalized.startsWith('/') ? normalized : `/${normalized}`;
    const segments = rooted.split('/').map((segment, index) => (index === 1 && isWindowsDrive(segment) ? segment : encodeURIComponent(segment)));

    return `file://${segments.join('/')}`;
}

/* The path behind a `file:` URI, in the form of the machine it names, or null for any other kind of URI or one that does not decode. */
export function fileUriToPath(uri: string): string | null {
    let url: URL;
    let path: string;

    try {
        url = new URL(uri);
        path = decodeURIComponent(url.pathname);
    } catch {
        return null;
    }

    if (url.protocol !== 'file:') {
        return null;
    }

    // A server in the URI names a UNC share, which only Windows reads as a path.
    if (url.hostname !== '' && url.hostname !== 'localhost') {
        return `\\\\${url.hostname}${path.replaceAll('/', '\\')}`;
    }

    if (/^\/[A-Za-z]:/.test(path)) {
        return path.slice(1).replaceAll('/', '\\');
    }

    return path;
}

/*
 * One key for every way a URI can name the same Windows file: servers write the drive in either
 * case, and some escape its colon (`file:///c%3A/...`). Any other URI is its own key.
 */
export function fileUriKey(uri: string): string {
    const path = fileUriToPath(uri);

    if (path === null || !/^[A-Za-z]:\\/.test(path)) {
        return uri;
    }

    return pathToFileUri(`${path[0]!.toUpperCase()}${path.slice(1)}`);
}
