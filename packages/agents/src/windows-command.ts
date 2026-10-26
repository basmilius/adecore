import { statSync } from 'node:fs';
import { win32 } from 'node:path';

export interface SpawnTarget {
    file: string;
    args: string[];
    // Set for a batch file: the command line is quoted here, so the spawn must pass it on unchanged.
    windowsVerbatimArguments?: boolean;
}

export interface SpawnTargetOptions {
    env?: Record<string, string | undefined>;
    platform?: NodeJS.Platform;
    isFile?(path: string): boolean;
}

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';
// What cmd.exe reads as syntax outside quotes, and so escapes with a caret.
const CMD_SPECIAL = /([()\][%!^"`<>&|;, *?])/g;

/*
 * The file and arguments a spawn starts a command with. On Windows a bare name is looked up on the
 * PATH with PATHEXT, which CreateProcess does not do, and a `.cmd` or `.bat` (npm installs every CLI
 * as one) runs through cmd.exe, as CreateProcess cannot start a batch file itself. Elsewhere nothing changes.
 */
export function spawnTarget(command: string, args: readonly string[], options: SpawnTargetOptions = {}): SpawnTarget {
    const { env = process.env, platform = process.platform, isFile = existingFile } = options;

    if (platform !== 'win32') {
        return { file: command, args: [...args] };
    }

    const resolved = findOnPath(command, env, isFile) ?? command;

    if (!/\.(cmd|bat)$/i.test(resolved)) {
        return { file: resolved, args: [...args] };
    }

    const line = [escapeForCmd(resolved), ...args.map((arg) => escapeForCmd(escapeForCmd(quoteArgument(arg))))].join(' ');

    return { file: variable(env, 'ComSpec') ?? 'cmd.exe', args: ['/d', '/s', '/c', `"${line}"`], windowsVerbatimArguments: true };
}

function findOnPath(command: string, env: Record<string, string | undefined>, isFile: (path: string) => boolean): string | null {
    const extensions = (variable(env, 'PATHEXT') ?? DEFAULT_PATHEXT)
        .split(';')
        .map((extension) => extension.trim().toLowerCase())
        .filter((extension) => extension !== '');

    const hasExtension = extensions.includes(win32.extname(command).toLowerCase());

    const folders = /[\\/]/.test(command)
        ? ['']
        : (variable(env, 'PATH') ?? '')
              .split(';')
              .map((folder) => folder.trim().replace(/^"(.*)"$/, '$1'))
              .filter((folder) => folder !== '');

    for (const folder of folders) {
        const base = folder === '' ? command : win32.join(folder, command);
        const candidates = hasExtension ? [base] : extensions.map((extension) => `${base}${extension}`);
        const found = candidates.find((candidate) => isFile(candidate));

        if (found !== undefined) {
            return found;
        }
    }

    return null;
}

// Windows treats variable names case-insensitively, and an environment often carries `Path`.
function variable(env: Record<string, string | undefined>, name: string): string | undefined {
    const key = Object.keys(env).find((candidate) => candidate.toUpperCase() === name.toUpperCase());

    return key === undefined ? undefined : env[key];
}

/* One argument as the C runtime splits a command line: quotes around it, a quote and the backslashes before it escaped. */
function quoteArgument(arg: string): string {
    if (/[\r\n]/.test(arg)) {
        throw new Error('An argument to a batch file cannot hold a line break');
    }

    return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1')}"`;
}

/*
 * Carets keep cmd.exe from reading the argument as syntax. An argument gets them twice: cmd.exe takes
 * one set as it runs the line, and the batch file reads them again where it hands `%*` on.
 */
function escapeForCmd(text: string): string {
    return text.replace(CMD_SPECIAL, '^$1');
}

function existingFile(path: string): boolean {
    try {
        return statSync(path).isFile();
    } catch {
        return false;
    }
}
