import type { ConnectionConfig, DatabaseResponse } from '../protocol/index.ts';

/* A running helper as the host sees it: lines in, lines out. `spawnHelper` makes one from a path. */
export interface HelperProcess {
    /* One message, without its line break. */
    write(line: string): void;
    onLine(listener: (line: string) => void): void;
    onExit(listener: (code: number | null) => void): void;
    kill(): void;
}

export interface DatabaseHostOptions {
    /* Starts a helper; called on the first request, and again on the first request after one exited. */
    start(): HelperProcess;
    /*
     * The app's say over which connections a page may open, asked on every `open` and `test`. A
     * connection it turns down fails with `forbidden`. Every connection is allowed when left out.
     */
    authorize?(connection: ConnectionConfig, owner: string): boolean | Promise<boolean>;
    /*
     * The app's say over the files a page may export to or import from, asked on every `export`,
     * `import` and `sample`. Every file is refused when left out, since the page names the path.
     */
    authorizeFile?(path: string, access: 'read' | 'write', owner: string): boolean | Promise<boolean>;
    /* The app's say over `discover`. Allowed when left out. */
    authorizeDiscovery?(kind: 'docker', owner: string): boolean | Promise<boolean>;
    /* How long to wait for the helper's `ready` line. 10000 when left out. */
    readyTimeoutMs?: number;
}

/*
 * The part of the backend between the app's channel and the helper. It registers no channel itself:
 * the app checks the sender, then calls `handle` with an owner that names it (a window, a socket).
 * A session belongs to the owner that opened it, and no other owner can use or cancel it.
 */
export interface DatabaseHost {
    /* Takes what came over the channel as it is, and checks its shape before anything reaches the helper. */
    handle(request: unknown, owner: string): Promise<DatabaseResponse>;
    /* Closes every session of an owner that went away. */
    release(owner: string): Promise<void>;
    /* Closes every session and stops the helper. */
    dispose(): Promise<void>;
}
