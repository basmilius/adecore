import { realpath, readFile, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import type { CustomScheme } from 'electron';
import { appWindowNavigation, isAppSender, originOf, type NavigationVerdict, type SenderFrame } from './web-guards.ts';

/*
 * Standard and secure give the page a real origin and a secure context (WebCrypto), fetch and CORS let it
 * load from the scheme and talk to a backend, streaming serves big files, the code cache keeps compiled
 * scripts between starts, and a service worker needs its own privilege.
 */
export const APP_SCHEME_PRIVILEGES: NonNullable<CustomScheme['privileges']> = {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
    codeCache: true,
    allowServiceWorkers: true
};

const CONTENT_TYPES: Readonly<Record<string, string>> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.map': 'application/json',
    '.webmanifest': 'application/manifest+json',
    // A WebAssembly module compiles while it streams only under its own type.
    '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.txt': 'text/plain; charset=utf-8'
};

export interface SchemeFolder {
    readonly root: string;
    /* A page that routes itself: an address without an extension gets its `index.html`. Otherwise only `/` does. */
    readonly routes?: boolean;
    /* On every response of the folder, such as a `Content-Security-Policy`, or per file. */
    readonly headers?: Record<string, string> | ((file: string) => Record<string, string>);
}

/* A host that answers a request itself, such as files it finds by an id; `serveFile` serves what it found. */
export type SchemeResolver = (request: Request, url: URL) => Response | Promise<Response>;

export interface AppSchemeOptions {
    /* Without the colon, such as `app`. */
    readonly scheme: string;
    /* The host of the page; `app` without one. */
    readonly host?: string;
    /* The built page. It routes itself unless `routes` is false. */
    readonly root: string;
    readonly routes?: boolean;
    readonly headers?: SchemeFolder['headers'];
    /* Other hosts on the same scheme, by name: a folder of their own or a resolver. */
    readonly hosts?: Readonly<Record<string, SchemeFolder | SchemeResolver>>;
    /* The URL the window loads instead, such as a dev server; the guards then take its origin for the app's. */
    readonly pageUrl?: string;
    readonly privileges?: CustomScheme['privileges'];
    /* Answers with a file the scheme found. Reads it whole without one; `net.fetch` of its `file:` URL streams it. */
    readonly read?: (file: string, request: Request) => Promise<Response>;
}

export interface AppScheme {
    readonly scheme: string;
    /* What the window loads: `pageUrl`, or the root of the page's host. */
    readonly url: string;
    /* The origin the guards take for the app's. */
    readonly origin: string;
    /* For `protocol.registerSchemesAsPrivileged`, before the app is ready. */
    readonly privileged: CustomScheme;
    /* For `protocol.handle`: the file a request names, or a 404. */
    handle(request: Request): Promise<Response>;
    /* Serves `file` when it lies inside `root`, for a resolver of a host. */
    serveFile(root: string, file: string, request: Request, headers?: Record<string, string>): Promise<Response>;
    originOf(url: string): string | null;
    isAppUrl(url: string): boolean;
    navigation(url: string): NavigationVerdict;
    isAppSender(isAppWindow: boolean, frame: SenderFrame | null): boolean;
}

const notFound = (): Response => new Response('Not found', { status: 404 });

const readWhole = async (file: string): Promise<Response> => new Response(new Uint8Array(await readFile(file)));

/* The segments of a path as the URL carries them, decoded, or null when one could climb out or means nothing on its own. */
export const segmentsOf = (pathname: string): string[] | null => {
    const path = pathname.replace(/^\/+/, '');
    if (path === '') {
        return [];
    }
    const segments: string[] = [];
    for (const raw of path.split('/')) {
        let segment: string;
        try {
            segment = decodeURIComponent(raw);
        } catch {
            return null;
        }
        if (segment === '' || segment === '.' || segment === '..' || /[/\\\0]/.test(segment)) {
            return null;
        }
        segments.push(segment);
    }
    return segments;
};

const isInside = (root: string, path: string): boolean => {
    const between = relative(root, path);
    return between !== '' && !between.startsWith('..') && !isAbsolute(between);
};

/*
 * Registers nothing by itself: the app hands `privileged` to `protocol.registerSchemesAsPrivileged`
 * before it is ready and `handle` to `protocol.handle`, on the sessions it picks. Every file it serves
 * lies inside the folder of its host, also after following a symlink.
 */
export function createAppScheme(options: AppSchemeOptions): AppScheme {
    const scheme = options.scheme;
    const pageHost = (options.host ?? 'app').toLowerCase();
    const schemes = [scheme];
    const own = `${scheme}://${pageHost}`;
    const url = options.pageUrl ?? `${own}/`;
    const origin = originOf(url, schemes) ?? own;
    const read = options.read ?? readWhole;
    const hosts = new Map<string, SchemeFolder | SchemeResolver>(Object.entries(options.hosts ?? {}).map(([name, host]) => [name.toLowerCase(), host]));
    hosts.set(pageHost, { root: options.root, routes: options.routes ?? true, headers: options.headers });

    const serveFile = async (root: string, file: string, request: Request, headers: Record<string, string> = {}): Promise<Response> => {
        let found: string;
        try {
            const [realRoot, realFile] = await Promise.all([realpath(resolve(root)), realpath(resolve(file))]);
            if (!isInside(realRoot, realFile) || !(await stat(realFile)).isFile()) {
                return notFound();
            }
            found = realFile;
        } catch {
            return notFound();
        }
        const response = await read(found, request);
        const merged = new Headers(response.headers);
        const type = CONTENT_TYPES[extname(found).toLowerCase()];
        if (type !== undefined) {
            merged.set('content-type', type);
        }
        for (const [name, value] of Object.entries(headers)) {
            merged.set(name, value);
        }
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
    };

    const serveFolder = (folder: SchemeFolder, request: Request, address: URL): Promise<Response> | Response => {
        const segments = segmentsOf(address.pathname);
        if (segments === null) {
            return notFound();
        }
        // A missing chunk with an extension stays a 404, so a stale one fails as a load error rather than as the page.
        const page = segments.length === 0 || (folder.routes === true && extname(segments.at(-1)!) === '');
        const file = page ? join(folder.root, 'index.html') : join(folder.root, ...segments);
        const headers = typeof folder.headers === 'function' ? folder.headers(file) : folder.headers;
        return serveFile(folder.root, file, request, headers);
    };

    return {
        scheme,
        url,
        origin,
        privileged: { scheme, privileges: options.privileges ?? APP_SCHEME_PRIVILEGES },
        handle: async (request) => {
            let address: URL;
            try {
                address = new URL(request.url);
            } catch {
                return notFound();
            }
            const host = address.protocol === `${scheme}:` ? hosts.get(address.host.toLowerCase()) : undefined;
            if (host === undefined) {
                return notFound();
            }
            return typeof host === 'function' ? host(request, address) : serveFolder(host, request, address);
        },
        serveFile,
        originOf: (address) => originOf(address, schemes),
        isAppUrl: (address) => originOf(address, schemes) === origin,
        navigation: (address) => appWindowNavigation(address, origin, schemes),
        isAppSender: (isAppWindow, frame) => isAppSender(isAppWindow, frame, origin, schemes)
    };
}
