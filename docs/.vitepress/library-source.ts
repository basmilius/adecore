import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../../packages/ui/', import.meta.url);

interface Manifest {
    name: string;
    exports: Record<string, { source: string }>;
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/*
 * Every entry point of the library, resolved through its `source` condition to the file in `src`, so
 * the docs always draw the code in this checkout. An alias rather than a dependency: Bun cannot link
 * the root package into a workspace, and a copy would go stale with the first edit.
 */
export const librarySourceAliases = (): { find: RegExp; replacement: string }[] => {
    const manifest = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8')) as Manifest;
    return Object.entries(manifest.exports).map(([subpath, targets]) => ({
        find: new RegExp(`^${escapeRegExp(manifest.name + subpath.slice(1))}$`),
        replacement: fileURLToPath(new URL(targets.source, ROOT))
    }));
};
