import type { Connection } from '../client/types.ts';
import type { DockerContainer, MysqlConnectionConfig } from '../protocol/index.ts';
import { DEFAULT_MYSQL_PORT, defaultConfig, withMode } from './connection-config.ts';

/* A container a MySQL connection can point at: what `discover` found, minus a file engine, which no container serves. */
export const isMysqlContainer = (container: DockerContainer): boolean => container.engine !== 'sqlite';

/* The Compose `project/service` of a container, when it has both. */
export const composeNameOf = (container: DockerContainer): string | null =>
    container.project !== null && container.service !== null ? `${container.project}/${container.service}` : null;

/* What names a container to a person: its Compose name, else its own. */
export const containerTitle = (container: DockerContainer): string => composeNameOf(container) ?? container.name;

/* The port to connect to inside the container: MySQL's own when the container lists it or lists nothing, else the first it lists. */
export const containerPortOf = (container: DockerContainer): number => {
    const ports = container.ports.map((entry) => entry.container);
    return ports.length === 0 || ports.includes(DEFAULT_MYSQL_PORT) ? DEFAULT_MYSQL_PORT : ports[0]!;
};

/* The host port a container publishes a port on, or `null` when it does not. */
export const publishedPortOf = (container: DockerContainer, port: number): number | null =>
    container.ports.find((entry) => entry.container === port)?.host ?? null;

const isEmpty = (text: string | undefined): boolean => text === undefined || text === '';

/* Points a config at a container. The user, the password and the database come from the container's environment only where the config has none. */
export const withContainer = (config: MysqlConnectionConfig, container: DockerContainer): MysqlConnectionConfig => {
    const docker = withMode(config, 'docker');
    const { user, password, database } = container.suggested;
    return {
        ...docker,
        user: isEmpty(docker.user) && user !== undefined ? user : docker.user,
        password: isEmpty(docker.password) && password !== undefined ? password : docker.password,
        database: isEmpty(docker.database) && database !== undefined ? database : docker.database,
        tunnel: {
            kind: 'docker',
            container: container.name,
            port: containerPortOf(container),
            ...(docker.tunnel?.kind === 'docker' && docker.tunnel.context !== undefined ? { context: docker.tunnel.context } : {})
        }
    };
};

/* A new MySQL connection to a container, named after its Compose `project/service` or its own name. */
export const connectionFromContainer = (id: string, container: DockerContainer): Connection => ({
    id,
    name: containerTitle(container),
    config: withContainer(defaultConfig('mysql') as MysqlConnectionConfig, container)
});
