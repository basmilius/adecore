import { describe, expect, test } from 'bun:test';
import type { Connection } from '../client/types.ts';
import { configProblems, defaultConfig, isAbsolutePath, isValidConfig, targetOf, withEngine } from './connection-config.ts';

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
