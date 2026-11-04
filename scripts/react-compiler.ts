import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformAsync, type PluginItem, type PluginObj } from '@babel/core';
import type { LoggerEvent, PluginOptions } from 'babel-plugin-react-compiler';

export interface ReactCompilerReport {
    /* Components and hooks the compiler memoized. */
    compiled: number;
    /* Functions it left as written, with why; such a function still works, it only draws again as before. */
    skipped: { file: string; reason: string }[];
}

const compilerPlugin = fileURLToPath(import.meta.resolve('babel-plugin-react-compiler'));
const jsxPlugin = fileURLToPath(import.meta.resolve('@babel/plugin-transform-react-jsx'));

function compilerOptions(file: string, report?: ReactCompilerReport): Partial<PluginOptions> {
    return {
        target: '19',
        // A function the compiler cannot prove safe stays as written instead of failing the build.
        panicThreshold: 'none',
        logger: {
            logEvent: (_filename: string | null, event: LoggerEvent) => {
                if (!report) {
                    return;
                }
                if (event.kind === 'CompileSuccess') {
                    report.compiled += 1;
                } else if (event.kind === 'CompileError') {
                    report.skipped.push({ file, reason: event.detail.reason });
                }
            }
        }
    };
}

/* tsc points an import of a `.tsx` module at `.jsx` when it keeps JSX; the JSX transform below makes that file `.js`. */
function jsxSpecifiersToJs(): PluginObj {
    const rewrite = (source: { value: string } | null | undefined): void => {
        if (source && source.value.startsWith('.') && source.value.endsWith('.jsx')) {
            source.value = source.value.slice(0, -1);
        }
    };
    return {
        visitor: {
            ImportDeclaration: (path) => rewrite(path.node.source),
            ExportAllDeclaration: (path) => rewrite(path.node.source),
            ExportNamedDeclaration: (path) => rewrite(path.node.source),
            CallExpression: (path) => {
                const [specifier] = path.node.arguments;
                if (path.node.callee.type === 'Import' && specifier?.type === 'StringLiteral') {
                    rewrite(specifier);
                }
            }
        }
    };
}

/*
 * Whether the compiler has anything to do in a module: it only takes components, which a module
 * without JSX has none of, and hooks. One that opts out as a whole would only be checked, and every
 * function in it counted as left out.
 */
function compilable(code: string, jsx: boolean): boolean {
    return !/^\s*['"]use no memo['"]/.test(code) && (jsx || /\buse[A-Z0-9]/.test(code));
}

async function* scripts(directory: string): AsyncGenerator<string> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            yield* scripts(path);
        } else if (/\.jsx?$/.test(entry.name)) {
            yield path;
        }
    }
}

/*
 * Runs the React Compiler over the JavaScript tsc wrote into `directory` with `jsx: preserve`, then
 * turns the JSX into `react/jsx-runtime` calls, so every `.jsx` becomes the `.js` the exports name.
 */
export async function compileReactDist(directory: string): Promise<ReactCompilerReport> {
    const report: ReactCompilerReport = { compiled: 0, skipped: [] };
    for await (const path of scripts(directory)) {
        const file = relative(directory, path);
        const code = await readFile(path, 'utf8');
        const compiler: PluginItem[] = compilable(code, path.endsWith('.jsx')) ? [[compilerPlugin, compilerOptions(file, report)]] : [];
        const result = await transformAsync(code, {
            filename: path,
            babelrc: false,
            configFile: false,
            sourceType: 'module',
            parserOpts: { plugins: ['jsx'] },
            plugins: [...compiler, [jsxPlugin, { runtime: 'automatic' }], jsxSpecifiersToJs]
        });
        if (!result?.code) {
            throw new Error(`The React Compiler wrote nothing for ${file}`);
        }
        await writeFile(path.replace(/\.jsx$/, '.js'), result.code);
        if (path.endsWith('.jsx')) {
            await rm(path);
        }
    }
    return report;
}

/* Compiles one TypeScript module the way its `dist` is compiled, and keeps it TypeScript, for a runtime that strips the types itself. */
export async function compileReactSource(code: string, path: string): Promise<string> {
    if (!compilable(code, path.endsWith('.tsx'))) {
        return code;
    }
    const result = await transformAsync(code, {
        filename: path,
        babelrc: false,
        configFile: false,
        sourceType: 'module',
        parserOpts: { plugins: path.endsWith('.tsx') ? ['typescript', 'jsx'] : ['typescript'] },
        plugins: [[compilerPlugin, compilerOptions(path)]]
    });
    return result?.code ?? code;
}

/* For a build log: how much the compiler took, and each function it left as written, by module and why. */
export function describeReactCompilerReport(name: string, report: ReactCompilerReport): string {
    const head = `${name}: the React Compiler memoized ${report.compiled} components and hooks, and left ${report.skipped.length} as written`;
    return [head, ...report.skipped.map(({ file, reason }) => `  ${file}: ${reason.split('. ')[0]}`)].join('\n');
}
