import { describe, expect, test } from 'bun:test';
import type { DockerContainer, MysqlConnectionConfig } from '../protocol/index.ts';
import { defaultConfig, modeOf } from './connection-config.ts';
import { composeNameOf, connectionFromContainer, containerPortOf, containerTitle, isMysqlContainer, publishedPortOf, withContainer } from './docker.ts';

const container = (patch: Partial<DockerContainer> = {}): DockerContainer => ({
    id: 'abc',
    name: 'shop-db-1',
    image: 'mariadb:11',
    engine: 'mysql',
    ports: [{ container: 3306, host: 32768 }],
    project: 'shop',
    service: 'db',
    suggested: { user: 'app', password: 'secret', database: 'shop' },
    ...patch
});

const blank = defaultConfig('mysql') as MysqlConnectionConfig;

describe('a Docker container', () => {
    test('is named after its Compose project and service, else its own name', () => {
        expect(composeNameOf(container())).toBe('shop/db');
        expect(containerTitle(container())).toBe('shop/db');
        expect(containerTitle(container({ project: null }))).toBe('shop-db-1');
        expect(containerTitle(container({ service: null }))).toBe('shop-db-1');
    });

    test('is a MySQL container unless it says SQLite', () => {
        expect(isMysqlContainer(container())).toBe(true);
        expect(isMysqlContainer(container({ engine: null }))).toBe(true);
        expect(isMysqlContainer(container({ engine: 'sqlite' }))).toBe(false);
    });

    test('connects to port 3306 inside, or else to the first port it lists', () => {
        expect(containerPortOf(container())).toBe(3306);
        expect(containerPortOf(container({ ports: [] }))).toBe(3306);
        expect(
            containerPortOf(
                container({
                    ports: [
                        { container: 3307, host: null },
                        { container: 3306, host: null }
                    ]
                })
            )
        ).toBe(3306);
        expect(containerPortOf(container({ ports: [{ container: 3307, host: null }] }))).toBe(3307);
    });

    test('publishes a port on the host, or does not', () => {
        expect(publishedPortOf(container(), 3306)).toBe(32768);
        expect(publishedPortOf(container({ ports: [{ container: 3306, host: null }] }), 3306)).toBeNull();
        expect(publishedPortOf(container(), 5432)).toBeNull();
    });
});

describe('withContainer', () => {
    test('points the config at the container and fills what is empty from its environment', () => {
        const config = withContainer(blank, container());
        expect(modeOf(config)).toBe('docker');
        expect(config).toMatchObject({ user: 'app', password: 'secret', database: 'shop', tunnel: { kind: 'docker', container: 'shop-db-1', port: 3306 } });
    });

    test('keeps what the person typed', () => {
        const config = withContainer({ ...blank, user: 'me', password: 'mine', database: 'mydb' }, container());
        expect(config).toMatchObject({ user: 'me', password: 'mine', database: 'mydb' });
    });

    test('keeps the Docker context of the tunnel it replaces', () => {
        const first = withContainer(blank, container());
        const again = withContainer(
            { ...first, tunnel: { ...first.tunnel!, kind: 'docker', container: 'x', context: 'remote' } },
            container({ name: 'other' })
        );
        expect(again.tunnel).toEqual({ kind: 'docker', container: 'other', port: 3306, context: 'remote' });
    });

    test('leaves a field empty when the container suggests nothing', () => {
        expect(withContainer(blank, container({ suggested: {} }))).toMatchObject({ user: '', password: '' });
    });
});

describe('connectionFromContainer', () => {
    test('makes a MySQL connection through Docker, named after the container', () => {
        expect(connectionFromContainer('id-1', container())).toMatchObject({
            id: 'id-1',
            name: 'shop/db',
            config: { engine: 'mysql', user: 'app', tunnel: { kind: 'docker', container: 'shop-db-1', port: 3306 } }
        });
        expect(connectionFromContainer('id-2', container({ project: null })).name).toBe('shop-db-1');
    });
});
