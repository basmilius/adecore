import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { runProcess } from './run-process.ts';
import { spawnTarget } from './windows-command.ts';

const files =
    (...paths: string[]) =>
    (path: string) =>
        paths.includes(path);

describe('spawnTarget', () => {
    test('leaves a command alone outside Windows', () => {
        expect(spawnTarget('codex', ['app-server'], { platform: 'linux', env: { PATH: '/usr/bin' }, isFile: () => true })).toEqual({
            file: 'codex',
            args: ['app-server']
        });
    });

    test('finds an executable on the PATH in the order of PATHEXT, under the name Windows gives the variable', () => {
        const target = spawnTarget('claude', ['--version'], {
            platform: 'win32',
            env: { Path: 'C:\\Tools;"C:\\Program Files\\Claude"', PATHEXT: '.COM;.EXE;.CMD' },
            isFile: files('C:\\Program Files\\Claude\\claude.exe', 'C:\\Program Files\\Claude\\claude.cmd')
        });

        expect(target).toEqual({ file: 'C:\\Program Files\\Claude\\claude.exe', args: ['--version'] });
    });

    test('runs a batch file through cmd.exe with every argument quoted and escaped twice', () => {
        const target = spawnTarget('codex', ['app-server', 'a b', 'say "hi" & go', '100%', 'C:\\dir\\'], {
            platform: 'win32',
            env: { PATH: 'C:\\npm', ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
            isFile: files('C:\\npm\\codex.cmd')
        });

        expect(target.file).toBe('C:\\Windows\\System32\\cmd.exe');
        expect(target.windowsVerbatimArguments).toBe(true);
        expect(target.args.slice(0, 3)).toEqual(['/d', '/s', '/c']);
        expect(target.args[3]).toBe(
            [
                '"C:\\npm\\codex.cmd',
                '^^^"app-server^^^"',
                '^^^"a^^^ b^^^"',
                '^^^"say^^^ \\^^^"hi\\^^^"^^^ ^^^&^^^ go^^^"',
                '^^^"100^^^%^^^"',
                '^^^"C:\\dir\\\\^^^""'
            ].join(' ')
        );
    });

    test('takes a path as it is, adding an extension only when it has none', () => {
        const isFile = files('C:\\bin\\tool.bat', 'C:\\bin\\other.exe');
        expect(spawnTarget('C:\\bin\\tool', [], { platform: 'win32', env: {}, isFile }).file).toBe('cmd.exe');
        expect(spawnTarget('C:\\bin\\other.exe', ['x'], { platform: 'win32', env: {}, isFile })).toEqual({ file: 'C:\\bin\\other.exe', args: ['x'] });
    });

    test('leaves a command it cannot find to the spawn, which reports it missing', () => {
        expect(spawnTarget('missing', ['x'], { platform: 'win32', env: { PATH: 'C:\\npm' }, isFile: () => false })).toEqual({
            file: 'missing',
            args: ['x']
        });
    });

    test('refuses a line break in an argument to a batch file, which cmd.exe would cut there', () => {
        expect(() => spawnTarget('codex', ['a\nb'], { platform: 'win32', env: { PATH: 'C:\\npm' }, isFile: files('C:\\npm\\codex.cmd') })).toThrow(
            'line break'
        );
    });
});

describe.skipIf(process.platform !== 'win32')('a batch file on Windows', () => {
    test('gets every argument as it was given', async () => {
        const folder = mkdtempSync(join(tmpdir(), 'windows-command-'));

        try {
            writeFileSync(join(folder, 'echo.js'), 'console.log(JSON.stringify(process.argv.slice(2)));\n');
            writeFileSync(join(folder, 'echo args.cmd'), `@"${process.execPath}" "%~dp0echo.js" %*\r\n`);
            const args = ['plain', 'a b', 'say "hi" & go', '100%', '%PATH%', 'C:\\dir\\', 'caret ^ pipe | <angle>', '!bang!', ''];
            const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'PATH'));
            const result = await runProcess(['echo args', ...args], { env: { ...env, PATH: `${folder};${process.env.PATH ?? ''}` } });
            expect(result.stderr).toBe('');
            expect(JSON.parse(result.stdout)).toEqual(args);
        } finally {
            rmSync(folder, { recursive: true, force: true });
        }
    });
});
