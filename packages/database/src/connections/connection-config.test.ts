import { describe, expect, test } from 'bun:test';
import type { Connection } from '../client/types.ts';
import type { MysqlConnectionConfig } from '../protocol/index.ts';
import { configProblems, defaultConfig, isAbsolutePath, isValidConfig, modeOf, targetOf, withEngine, withMode } from './connection-config.ts';

const mysql = (patch: Record<string, unknown> = {}): Connection => ({
    id: 'a',
    name: 'Local',
    config: { ...(defaultConfig('mysql') as object), host: 'db.test', user: 'root', ...patch } as Connection['config']
});

describe('connection config', () => {
    test('a new config of each engine starts at its defaults', () => {
        expect(defaultConfig('sqlite')).toEqual({ engine: 'sqlite', path: '', create: false, readOnly: false });
        expect(defaultConfig('mysql')).toMatchObject({ engine: 'mysql', port: 3306, tls: 'prefer' });
    });

    test('switching engine keeps the id and the name and resets the config', () => {
        const next = withEngine(mysql(), 'sqlite');
        expect(next).toEqual({ id: 'a', name: 'Local', config: defaultConfig('sqlite') });
        const same = mysql();
        expect(withEngine(same, 'mysql')).toBe(same);
    });

    test('knows an absolute path from a relative one', () => {
        expect(['/var/db.sqlite', 'C:\\data\\db.sqlite', 'C:/data/db.sqlite', '\\\\host\\share\\db'].map(isAbsolutePath)).toEqual([true, true, true, true]);
        expect(['db.sqlite', './db.sqlite', '~/db.sqlite', ''].map(isAbsolutePath)).toEqual([false, false, false, false]);
    });

    test('flags a missing or relative SQLite path', () => {
        expect(configProblems({ engine: 'sqlite', path: '' })).toEqual({ path: 'path-required' });
        expect(configProblems({ engine: 'sqlite', path: 'db.sqlite' })).toEqual({ path: 'path-relative' });
        expect(isValidConfig({ engine: 'sqlite', path: '/db.sqlite' })).toBe(true);
    });

    test('flags a missing host unless a socket stands in for it, and a port out of range', () => {
        expect(configProblems(mysql({ host: ' ' }).config)).toEqual({ host: 'host-required' });
        expect(configProblems(mysql({ host: '', socket: '/tmp/mysql.sock' }).config)).toEqual({});
        for (const port of [0, 65536, 1.5, Number.NaN]) {
            expect(configProblems(mysql({ port }).config)).toEqual({ port: 'port-range' });
        }
        expect(configProblems(mysql({ port: undefined }).config)).toEqual({});
        expect(configProblems(mysql({ port: 65535 }).config)).toEqual({});
    });

    test('names the target of a connection in a short line', () => {
        expect(targetOf({ id: 'a', name: 'n', config: { engine: 'sqlite', path: '/var/data/app.sqlite' } })).toBe('app.sqlite');
        expect(targetOf(mysql())).toBe('root@db.test:3306');
        expect(targetOf(mysql({ port: undefined, user: '' }))).toBe('db.test:3306');
        expect(targetOf(mysql({ socket: '/tmp/mysql.sock' }))).toBe('root@mysql.sock');
    });
});

const ssh = (tunnel: Record<string, unknown> = {}, patch: Record<string, unknown> = {}): Connection =>
    mysql({ host: '127.0.0.1', tunnel: { kind: 'ssh', host: 'bastion', ...tunnel }, ...patch });
const docker = (tunnel: Record<string, unknown> = {}, patch: Record<string, unknown> = {}): Connection =>
    mysql({ tunnel: { kind: 'docker', container: 'shop-db-1', port: 3306, ...tunnel }, ...patch });

describe('the way a MySQL connection connects', () => {
    test('reads the mode from the config', () => {
        expect(modeOf(mysql().config as MysqlConnectionConfig)).toBe('tcp');
        expect(modeOf(mysql({ socket: '' }).config as MysqlConnectionConfig)).toBe('socket');
        expect(modeOf(ssh().config as MysqlConnectionConfig)).toBe('ssh');
        expect(modeOf(docker().config as MysqlConnectionConfig)).toBe('docker');
    });

    test('moves to another mode and keeps who the connection logs in as', () => {
        const base = mysql({ user: 'app', password: 'secret', database: 'shop', readOnly: true }).config as MysqlConnectionConfig;
        const viaSsh = withMode(base, 'ssh');
        expect(viaSsh).toMatchObject({ user: 'app', password: 'secret', database: 'shop', readOnly: true, tunnel: { kind: 'ssh', host: '' } });
        expect(modeOf(viaSsh)).toBe('ssh');
        expect(withMode(viaSsh, 'docker').tunnel).toEqual({ kind: 'docker', container: '', port: 3306 });
        expect(withMode(viaSsh, 'socket')).toMatchObject({ socket: '', tunnel: undefined });
        expect(withMode(withMode(viaSsh, 'socket'), 'tcp')).toMatchObject({ socket: undefined, tunnel: undefined, host: 'db.test' });
        expect(withMode(base, 'tcp')).toBe(base);
    });

    test('falls back to the local host when a mode is left with none', () => {
        expect(withMode({ ...(defaultConfig('mysql') as MysqlConnectionConfig), host: ' ' }, 'ssh').host).toBe('127.0.0.1');
    });

    test('asks a socket for its path', () => {
        expect(configProblems(mysql({ socket: '' }).config)).toEqual({ socket: 'socket-required' });
        expect(configProblems(mysql({ socket: '  ' }).config)).toEqual({ socket: 'socket-required' });
        expect(configProblems(mysql({ socket: '/tmp/mysql.sock', host: '', port: 0 }).config)).toEqual({});
    });

    test('asks SSH for its host and for the server behind it, and checks both ports', () => {
        expect(configProblems(ssh().config)).toEqual({});
        expect(configProblems(ssh({ host: ' ' }).config)).toEqual({ sshHost: 'ssh-host-required' });
        expect(configProblems(ssh({}, { host: '' }).config)).toEqual({ host: 'host-required' });
        expect(configProblems(ssh({ port: 70000 }).config)).toEqual({ sshPort: 'ssh-port-range' });
        expect(configProblems(ssh({}, { port: 0 }).config)).toEqual({ port: 'port-range' });
        expect(configProblems(ssh({ port: 22, user: 'deploy', identityFile: '~/.ssh/id' }).config)).toEqual({});
    });

    test('asks Docker for a container and ignores the host and the port of the server', () => {
        expect(configProblems(docker().config)).toEqual({});
        expect(configProblems(docker({ container: '' }).config)).toEqual({ container: 'container-required' });
        expect(configProblems(docker({ port: 0 }).config)).toEqual({ containerPort: 'container-port-range' });
        expect(configProblems(docker({}, { host: '', port: 0 }).config)).toEqual({});
        expect(isValidConfig(docker({ container: '' }).config)).toBe(false);
    });

    test('names the target of every mode', () => {
        expect(targetOf(ssh())).toBe('root@127.0.0.1 via bastion');
        expect(targetOf(ssh({ host: '' }))).toBe('root@127.0.0.1');
        expect(targetOf(docker())).toBe('root@shop-db-1 (Docker)');
        expect(targetOf(docker({ container: '' }, { user: '' }))).toBe('Docker');
        expect(targetOf(mysql({ socket: '', user: '' }))).toBe('');
    });
});
