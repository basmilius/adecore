import type { ConnectionConfig, Engine, MysqlConnectionConfig, SqliteConnectionConfig } from '../protocol/index.ts';
import type { Connection } from '../client/types.ts';

export const DEFAULT_MYSQL_PORT = 3306;
export const DEFAULT_HOST = '127.0.0.1';

/* How a MySQL connection reaches its server. */
export type ConnectMode = 'tcp' | 'socket' | 'ssh' | 'docker';

export const CONNECT_MODES: readonly ConnectMode[] = ['tcp', 'socket', 'ssh', 'docker'];

/* What a field can be wrong about; the form maps each code onto a sentence. */
export type ConfigProblem =
    | 'path-required'
    | 'path-relative'
    | 'host-required'
    | 'port-range'
    | 'socket-required'
    | 'ssh-host-required'
    | 'ssh-port-range'
    | 'container-required'
    | 'container-port-range';

export type ConfigProblems = Partial<Record<'path' | 'host' | 'port' | 'socket' | 'sshHost' | 'sshPort' | 'container' | 'containerPort', ConfigProblem>>;

/* A config of this engine with every field at what a new connection starts with. */
export const defaultConfig = (engine: Engine): ConnectionConfig =>
    engine === 'sqlite'
        ? { engine: 'sqlite', path: '', create: false, readOnly: false }
        : { engine: 'mysql', host: DEFAULT_HOST, port: DEFAULT_MYSQL_PORT, user: '', password: '', tls: 'prefer', readOnly: false };

/* A POSIX path, a Windows drive path or a UNC path. A relative one would resolve against the helper's working directory. */
export const isAbsolutePath = (path: string): boolean => /^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(path);

const sqliteProblems = (config: SqliteConnectionConfig): ConfigProblems => {
    const path = config.path.trim();
    if (path === '') {
        return { path: 'path-required' };
    }
    return isAbsolutePath(path) ? {} : { path: 'path-relative' };
};

const isPort = (port: number): boolean => Number.isInteger(port) && port >= 1 && port <= 65535;

/* The mode is in the config: a socket means the socket mode, even while its path is still empty, and a tunnel names its own. */
export const modeOf = (config: MysqlConnectionConfig): ConnectMode => {
    if (config.tunnel !== undefined) {
        return config.tunnel.kind;
    }
    return config.socket === undefined ? 'tcp' : 'socket';
};

const mysqlProblems = (config: MysqlConnectionConfig): ConfigProblems => {
    const problems: { -readonly [K in keyof ConfigProblems]: ConfigProblems[K] } = {};
    const tunnel = config.tunnel;
    const mode = modeOf(config);
    if (mode === 'socket' && (config.socket ?? '').trim() === '') {
        problems.socket = 'socket-required';
    }
    if ((mode === 'tcp' || mode === 'ssh') && config.host.trim() === '') {
        problems.host = 'host-required';
    }
    if ((mode === 'tcp' || mode === 'ssh') && config.port !== undefined && !isPort(config.port)) {
        problems.port = 'port-range';
    }
    if (tunnel?.kind === 'ssh') {
        if (tunnel.host.trim() === '') {
            problems.sshHost = 'ssh-host-required';
        }
        if (tunnel.port !== undefined && !isPort(tunnel.port)) {
            problems.sshPort = 'ssh-port-range';
        }
    }
    if (tunnel?.kind === 'docker') {
        if (tunnel.container.trim() === '') {
            problems.container = 'container-required';
        }
        if (tunnel.port !== undefined && !isPort(tunnel.port)) {
            problems.containerPort = 'container-port-range';
        }
    }
    return problems;
};

/* What is wrong with a config, field by field: the codes the form shows. Empty for a config with nothing to fix. */
export const configProblems = (config: ConnectionConfig): ConfigProblems => (config.engine === 'sqlite' ? sqliteProblems(config) : mysqlProblems(config));

/* Whether a connection can be saved, rather than a draft a person is still filling in. */
export const isValidConfig = (config: ConnectionConfig): boolean => Object.keys(configProblems(config)).length === 0;

const lastSegment = (path: string): string => {
    const segments = path.split(/[\\/]/).filter((segment) => segment !== '');
    return segments[segments.length - 1] ?? path;
};

const targetWhere = (config: MysqlConnectionConfig): string => {
    const tunnel = config.tunnel;
    if (tunnel?.kind === 'docker') {
        return tunnel.container === '' ? 'Docker' : `${tunnel.container} (Docker)`;
    }
    if (tunnel?.kind === 'ssh') {
        return tunnel.host === '' ? config.host : `${config.host} via ${tunnel.host}`;
    }
    if (config.socket !== undefined) {
        return lastSegment(config.socket);
    }
    return `${config.host}:${config.port ?? DEFAULT_MYSQL_PORT}`;
};

/* The short line under a connection's name: the file name of a database file, or `user@host:port`, `user@host via <ssh host>` and `user@container (Docker)`. */
export const targetOf = (connection: Connection): string => {
    const config = connection.config;
    if (config.engine === 'sqlite') {
        return lastSegment(config.path);
    }
    const where = targetWhere(config);
    return config.user === '' || where === '' ? where : `${config.user}@${where}`;
};

/* Moves to another way of reaching the server. What the person typed for the user, the password and the database stays. */
export const withMode = (config: MysqlConnectionConfig, mode: ConnectMode): MysqlConnectionConfig => {
    if (modeOf(config) === mode) {
        return config;
    }
    const base: MysqlConnectionConfig = {
        ...config,
        host: config.host.trim() === '' ? DEFAULT_HOST : config.host,
        socket: undefined,
        tunnel: undefined
    };
    switch (mode) {
        case 'tcp':
            return base;
        case 'socket':
            return { ...base, socket: '' };
        case 'ssh':
            return { ...base, tunnel: { kind: 'ssh', host: '' } };
        case 'docker':
            return { ...base, tunnel: { kind: 'docker', container: '', port: DEFAULT_MYSQL_PORT } };
    }
};

/* Moves to another engine, which keeps who the connection is and drops how it connects. */
export const withEngine = (connection: Connection, engine: Engine): Connection =>
    connection.config.engine === engine ? connection : { id: connection.id, name: connection.name, config: defaultConfig(engine) };
