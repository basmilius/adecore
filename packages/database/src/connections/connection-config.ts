import type { ConnectionConfig, Engine, MysqlConnectionConfig, SqliteConnectionConfig } from '../protocol/index.ts';
import type { Connection } from '../client/types.ts';

export const DEFAULT_MYSQL_PORT = 3306;

/* What a field can be wrong about; the form maps each code onto a sentence. */
export type ConfigProblem = 'path-required' | 'path-relative' | 'host-required' | 'port-range';

export type ConfigProblems = Partial<Record<'path' | 'host' | 'port', ConfigProblem>>;

/* A config of this engine with every field at what a new connection starts with. */
export const defaultConfig = (engine: Engine): ConnectionConfig =>
    engine === 'sqlite'
        ? { engine: 'sqlite', path: '', create: false, readOnly: false }
        : { engine: 'mysql', host: '127.0.0.1', port: DEFAULT_MYSQL_PORT, user: '', password: '', tls: 'prefer', readOnly: false };

/* A POSIX path, a Windows drive path or a UNC path. A relative one would resolve against the helper's working directory. */
export const isAbsolutePath = (path: string): boolean => /^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(path);

const sqliteProblems = (config: SqliteConnectionConfig): ConfigProblems => {
    const path = config.path.trim();
    if (path === '') {
        return { path: 'path-required' };
    }
    return isAbsolutePath(path) ? {} : { path: 'path-relative' };
};

const mysqlProblems = (config: MysqlConnectionConfig): ConfigProblems => {
    const problems: { -readonly [K in keyof ConfigProblems]: ConfigProblems[K] } = {};
    // A socket stands in for the host and the port.
    if (config.socket === undefined && config.host.trim() === '') {
        problems.host = 'host-required';
    }
    if (config.port !== undefined && (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)) {
        problems.port = 'port-range';
    }
    return problems;
};

export const configProblems = (config: ConnectionConfig): ConfigProblems => (config.engine === 'sqlite' ? sqliteProblems(config) : mysqlProblems(config));

export const isValidConfig = (config: ConnectionConfig): boolean => Object.keys(configProblems(config)).length === 0;

const lastSegment = (path: string): string => {
    const segments = path.split(/[\\/]/).filter((segment) => segment !== '');
    return segments[segments.length - 1] ?? path;
};

/* The short line under a connection's name: the file name of a database file, or `user@host:port`. */
export const targetOf = (connection: Connection): string => {
    const config = connection.config;
    if (config.engine === 'sqlite') {
        return lastSegment(config.path);
    }
    const where = config.socket !== undefined && config.socket !== '' ? lastSegment(config.socket) : `${config.host}:${config.port ?? DEFAULT_MYSQL_PORT}`;
    return config.user === '' ? where : `${config.user}@${where}`;
};

/* Moves to another engine, which keeps who the connection is and drops how it connects. */
export const withEngine = (connection: Connection, engine: Engine): Connection =>
    connection.config.engine === engine ? connection : { id: connection.id, name: connection.name, config: defaultConfig(engine) };
