import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { Glob } from 'bun';

const ROOT = join(new URL('.', import.meta.url).pathname, '..');

export interface PublishedEntry {
    readonly pkg: string;
    /* The subpath it is imported from, `.` for the root. */
    readonly entry: string;
    /* From the repository's root. */
    readonly file: string;
}

function moduleOf(from: string, specifier: string): string | null {
    const base = resolve(dirname(from), specifier);
    return (
        [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')].find((path) => /\.tsx?$/.test(path) && existsSync(path)) ?? null
    );
}

/*
 * The names a module exports, types included, read from its text: named exports, declarations,
 * `export * as` and what `export *` passes on. A default export has no name of its own and is left out.
 */
export function exportedNames(file: string, seen = new Set<string>()): string[] {
    if (seen.has(file)) {
        return [];
    }
    seen.add(file);
    const text = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
    const names: string[] = [];
    for (const match of text.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm)) {
        for (const part of match[1]!.split(',')) {
            const name = part
                .trim()
                .replace(/^type\s+/, '')
                .split(/\s+as\s+/)
                .at(-1)!
                .trim();
            if (name !== '' && name !== 'default') {
                names.push(name);
            }
        }
    }
    for (const match of text.matchAll(
        /^export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|interface|type|enum|namespace)\s+([\w$]+)/gm
    )) {
        names.push(match[1]!);
    }
    for (const match of text.matchAll(/^export\s+\*\s+as\s+([\w$]+)\s+from/gm)) {
        names.push(match[1]!);
    }
    for (const match of text.matchAll(/^export\s+\*\s+from\s+['"]([^'"]+)['"]/gm)) {
        const target = moduleOf(file, match[1]!);
        if (target !== null) {
            names.push(...exportedNames(target, seen));
        }
    }
    return [...new Set(names)];
}

/* Every TypeScript entry point of every package that is published, a wildcard export expanded to its modules. */
export function publishedEntries(): PublishedEntry[] {
    const entries: PublishedEntry[] = [];
    for (const manifest of [...new Glob('packages/*/package.json').scanSync({ cwd: ROOT })].sort()) {
        const json = JSON.parse(readFileSync(join(ROOT, manifest), 'utf8')) as { name: string; private?: boolean; exports?: Record<string, unknown> };
        if (json.private === true) {
            continue;
        }
        const folder = dirname(manifest);
        for (const [entry, target] of Object.entries(json.exports ?? {})) {
            const source = (target as { source?: unknown } | null)?.source;
            if (typeof source !== 'string' || !/\.tsx?$/.test(source)) {
                continue;
            }
            if (!source.includes('*')) {
                entries.push({ pkg: json.name, entry, file: join(folder, source) });
                continue;
            }
            const [before, after] = source.split('*') as [string, string];
            for (const path of [...new Glob(source.replace('*', '**/*')).scanSync({ cwd: join(ROOT, folder) })].sort()) {
                if (!/\.test\.tsx?$/.test(path)) {
                    const module = relative(before, path).slice(0, -after.length);
                    entries.push({ pkg: json.name, entry: entry.replace('*', module), file: join(folder, path) });
                }
            }
        }
    }
    return entries;
}

export function absolute(file: string): string {
    return join(ROOT, file);
}
