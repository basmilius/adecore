/* A database file on the machine the helper runs on. */
export interface SqliteConnectionConfig {
    readonly engine: 'sqlite';
    /* An absolute path. The helper never creates the file unless `create` is set. */
    readonly path: string;
    readonly create?: boolean;
    readonly readOnly?: boolean;
}

/* How the connection to a MySQL or MariaDB server is encrypted. `prefer` falls back to plain text when the server offers no TLS; `verify` also checks the certificate against the host name. */
export type MysqlTlsMode = 'disable' | 'prefer' | 'require' | 'verify';

/*
 * A server reached through a host the helper can SSH into. The helper runs the system's `ssh -W` for
 * every connection, so `~/.ssh/config`, the agent and `ProxyJump` apply, and it never asks for a
 * password: a key or the agent has to answer.
 */
export interface SshTunnel {
    readonly kind: 'ssh';
    /* A host name, or a `Host` of `~/.ssh/config`. */
    readonly host: string;
    readonly port?: number;
    readonly user?: string;
    readonly identityFile?: string;
}

/*
 * A server in a Docker container. The helper connects to the port the container publishes, or, when it
 * publishes none, through `docker exec`, which needs `bash` in the container.
 */
export interface DockerTunnel {
    readonly kind: 'docker';
    /* The name or id of the container. */
    readonly container: string;
    /* The port inside the container; the engine's default when left out. */
    readonly port?: number;
    /* A Docker context other than the current one. */
    readonly context?: string;
}

export type Tunnel = SshTunnel | DockerTunnel;

/* A MySQL or MariaDB server, over TCP or a Unix socket, directly or through a tunnel. */
export interface MysqlConnectionConfig {
    readonly engine: 'mysql';
    /* As the far end of the tunnel sees it when there is one; a Docker tunnel ignores it. */
    readonly host: string;
    /* 3306 when left out. */
    readonly port?: number;
    /* A Unix socket to connect through instead of `host` and `port`. */
    readonly socket?: string;
    readonly user: string;
    readonly password?: string;
    /* The schema a session starts in; a session without one sees every schema and has none selected. */
    readonly database?: string;
    readonly tls?: MysqlTlsMode;
    readonly readOnly?: boolean;
    readonly tunnel?: Tunnel;
}

export type ConnectionConfig = SqliteConnectionConfig | MysqlConnectionConfig;

export type Engine = ConnectionConfig['engine'];

/* What answered: one engine can be served by more than one product, which differ in SQL. */
export interface ServerInfo {
    readonly flavor: 'sqlite' | 'mysql' | 'mariadb';
    /* The version as the server reports it, such as `11.4.2-MariaDB`. */
    readonly version: string;
}

/* A running container that looks like it serves a database, as `discover` lists it. */
export interface DockerContainer {
    readonly id: string;
    readonly name: string;
    readonly image: string;
    /* What the image or its ports suggest; `null` when neither says. */
    readonly engine: Engine | null;
    /* The ports inside the container with the host port each is published on, or `null` when it is not. */
    readonly ports: readonly { readonly container: number; readonly host: number | null }[];
    /* From the Compose labels, so a list can group the containers of one project. */
    readonly project: string | null;
    readonly service: string | null;
    /* What the container's environment sets for the image's own variables (`MYSQL_DATABASE`, `MARIADB_USER`, ...), to fill a form with. */
    readonly suggested: { readonly user?: string; readonly password?: string; readonly database?: string };
}
