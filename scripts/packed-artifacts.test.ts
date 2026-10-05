import { expect, test } from 'bun:test';
import { packedEntrypoints } from './packed-artifacts.ts';
import type { PackageManifest } from './workspaces.ts';

const manifest: PackageManifest = {
    name: '@adecore/example',
    license: 'FSL-1.1-MIT',
    exports: {
        './*': { source: './src/*.ts', types: './dist/*.d.ts', default: './dist/*.js' },
        './theme.css': { source: './src/theme.css', default: './dist/theme.css' }
    }
};
const files = ['LICENSE', 'src/host.ts', 'dist/host.js', 'dist/host.d.ts', 'src/theme.css', 'dist/theme.css'];

test('expands packed wildcard entrypoints and validates both source and declarations', () => {
    expect(packedEntrypoints(manifest, files)).toEqual(['@adecore/example/host', '@adecore/example/theme.css']);
    expect(() =>
        packedEntrypoints(
            manifest,
            files.filter((file) => file !== 'dist/host.d.ts')
        )
    ).toThrow('dist/host.d.ts');
    expect(() =>
        packedEntrypoints(
            manifest,
            files.filter((file) => file !== 'src/host.ts')
        )
    ).toThrow('src/host.ts');
    expect(() =>
        packedEntrypoints(
            manifest,
            files.filter((file) => file !== 'dist/theme.css')
        )
    ).toThrow('no packed default');
});

test('rejects accidentally published tests, lost licenses and source-only exports', () => {
    expect(() => packedEntrypoints(manifest, [...files, 'src/host.test.ts'])).toThrow('tests or snapshots');
    expect(() =>
        packedEntrypoints(
            manifest,
            files.filter((file) => file !== 'LICENSE')
        )
    ).toThrow('LICENSE');
    expect(() => packedEntrypoints({ name: '@adecore/example', exports: { '.': './src/index.ts' } }, files)).toThrow('source and default');
});
