import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { helperPath } from './helper-path.ts';

const present = (): boolean => true;

const find = (platform: string, arch: string, resolve: ((specifier: string) => string) | undefined, exists: (path: string) => boolean): string | null =>
    helperPath({ platform, arch, resolve, exists });

describe('helperPath', () => {
    test('returns the binary next to the package of the platform and architecture', () => {
        expect(find('linux', 'arm64', () => join('/app/node_modules/@adecore/database-linux-arm64', 'package.json'), present)).toBe(
            join('/app/node_modules/@adecore/database-linux-arm64', 'bin', 'adecore-database')
        );
    });

    test('asks for the package named after the platform and architecture', () => {
        const asked: string[] = [];
        find(
            'linux',
            'x64',
            (specifier) => {
                asked.push(specifier);
                return '/pkg/package.json';
            },
            present
        );
        expect(asked).toEqual(['@adecore/database-linux-x64/package.json']);
    });

    test('adds .exe on Windows', () => {
        expect(find('win32', 'x64', () => join('/pkg', 'package.json'), present)).toBe(join('/pkg', 'bin', 'adecore-database.exe'));
    });

    test('maps app.asar to app.asar.unpacked', () => {
        const resolve = () => join('/Applications/App.app/Contents/Resources/app.asar/node_modules/@adecore/database-darwin-arm64', 'package.json');
        expect(find('darwin', 'arm64', resolve, present)).toBe(
            join('/Applications/App.app/Contents/Resources/app.asar.unpacked/node_modules/@adecore/database-darwin-arm64', 'bin', 'adecore-database')
        );
    });

    test('checks the unpacked path, not the archive path', () => {
        const checked: string[] = [];
        find(
            'darwin',
            'arm64',
            () => join('/r/app.asar/pkg', 'package.json'),
            (path) => {
                checked.push(path);
                return true;
            }
        );
        expect(checked).toEqual([join('/r/app.asar.unpacked/pkg', 'bin', 'adecore-database')]);
    });

    test('returns null when the package is not installed', () => {
        const missing = (): string => {
            throw new Error('Cannot find module');
        };
        expect(find('linux', 'x64', missing, present)).toBeNull();
    });

    test('returns null when the package has no binary', () => {
        expect(
            find(
                'linux',
                'x64',
                () => join('/pkg', 'package.json'),
                () => false
            )
        ).toBeNull();
    });

    test('returns null on a platform without a package', () => {
        expect(find('freebsd', 'x64', undefined, () => true)).toBeNull();
    });
});
