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

/* A MySQL or MariaDB server, over TCP or a Unix socket. */
export interface MysqlConnectionConfig {
    readonly engine: 'mysql';
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
}

export type ConnectionConfig = SqliteConnectionConfig | MysqlConnectionConfig;

export type Engine = ConnectionConfig['engine'];

/* What answered: one engine can be served by more than one product, which differ in SQL. */
export interface ServerInfo {
    readonly flavor: 'sqlite' | 'mysql' | 'mariadb';
    /* The version as the server reports it, such as `11.4.2-MariaDB`. */
    readonly version: string;
}
