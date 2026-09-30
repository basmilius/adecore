import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

const ROOT = join(import.meta.dir, '..', '..');

/* The library's own copy of a package, and of what that copy resolves next to it. */
const copyOf = (name: string, from = ROOT): string => realpathSync(dirname(Bun.resolveSync(`${name}/package.json`, from)));

/*
 * An app beside the library with React of its own, as a linked checkout meets it: its copies are real
 * folders, so they load as a second React unless the preload stands in for the checkout's.
 */
let app: string;

const run = (bunfig: string | null): { passed: boolean; output: string } => {
    rmSync(join(app, 'bunfig.toml'), { force: true });
    if (bunfig !== null) {
        writeFileSync(join(app, 'bunfig.toml'), bunfig);
    }
    const result = Bun.spawnSync([process.execPath, 'test', '--conditions=source'], { cwd: app, stdout: 'pipe', stderr: 'pipe' });
    return { passed: result.exitCode === 0, output: `${result.stdout.toString()}${result.stderr.toString()}` };
};

beforeAll(() => {
    app = mkdtempSync(join(tmpdir(), 'desktop-ui-dedupe-'));
    const modules = join(app, 'node_modules');
    const reactDom = copyOf('react-dom');
    const copies: [string, string][] = [
        ['react', copyOf('react')],
        ['react-dom', reactDom],
        ['scheduler', copyOf('scheduler', reactDom)]
    ];
    for (const [name, path] of copies) {
        cpSync(path, join(modules, name), { recursive: true, dereference: true });
    }
    mkdirSync(join(modules, '@basmilius'), { recursive: true });
    symlinkSync(ROOT, join(modules, '@basmilius', 'desktop-ui'));
    writeFileSync(
        join(app, 'package.json'),
        JSON.stringify({ name: 'app', private: true, dependencies: { '@basmilius/desktop-ui': 'link:@basmilius/desktop-ui' } })
    );
    writeFileSync(join(app, 'tsconfig.json'), JSON.stringify({ compilerOptions: { jsx: 'react-jsx' } }));
    writeFileSync(
        join(app, 'field.test.tsx'),
        [
            "import { expect, test } from 'bun:test';",
            "import { renderToStaticMarkup } from 'react-dom/server';",
            "import { Field } from '@basmilius/desktop-ui';",
            "test('the library renders with the app React', () => {",
            '    expect(renderToStaticMarkup(<Field label="Name"><span /></Field>)).toContain(\'<label\');',
            '});'
        ].join('\n')
    );
});

afterAll(() => {
    rmSync(app, { recursive: true, force: true });
});

describe('the dedupe preload', () => {
    test('a linked checkout brings a second React without it', () => {
        const { passed, output } = run(null);
        expect(passed).toBe(false);
        expect(output).toContain('Invalid hook call');
    });

    test('the library renders with the app React once the preload stands in for the checkout copy', () => {
        const { passed, output } = run('[test]\npreload = ["@basmilius/desktop-ui/testing/dedupe"]\n');
        expect(output).toContain('1 pass');
        expect(passed).toBe(true);
    });
});
