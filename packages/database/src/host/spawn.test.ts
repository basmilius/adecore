import { describe, expect, test } from 'bun:test';
import { spawnHelper } from './spawn.ts';

const SCRIPT = `
let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let at;
    while ((at = buffer.indexOf('\\n')) !== -1) {
        const line = buffer.slice(0, at);
        buffer = buffer.slice(at + 1);
        handle(line);
    }
});
const handle = (line) => {
    if (line === 'big') {
        const text = 'x'.repeat(3000000);
        for (let at = 0; at < text.length; at += 65536) {
            process.stdout.write(text.slice(at, at + 65536));
        }
        process.stdout.write('\\n');
    } else if (line === 'split') {
        process.stdout.write('ab');
        setTimeout(() => {
            process.stdout.write('cd\\r\\n\\nef');
            setTimeout(() => process.stdout.write('gh\\n'), 30);
        }, 30);
    } else if (line === 'multibyte') {
        process.stdout.write(Buffer.from([0xc3]));
        setTimeout(() => process.stdout.write(Buffer.from([0xa9, 0x0a])), 30);
    } else if (line === 'err') {
        process.stderr.write('oops\\nsecond\\n');
        process.stdout.write('after-err\\n');
    } else if (line === 'tail') {
        process.stdout.write('no-newline');
        process.exit(0);
    } else if (line === 'exit') {
        process.stdout.write('bye\\n');
        process.exit(3);
    } else if (line === 'env') {
        process.stdout.write(process.env.HELPER_TEST + ' ' + process.argv.slice(1).join(',') + '\\n');
    } else {
        process.stdout.write('echo:' + line + '\\n');
    }
};
`;

const launch = (options: Parameters<typeof spawnHelper>[1] = {}) => {
    const helper = spawnHelper(process.execPath, { ...options, args: ['-e', SCRIPT, '--', ...(options.args ?? [])] });
    const lines: string[] = [];
    const exits: (number | null)[] = [];
    helper.onLine((line) => lines.push(line));
    helper.onExit((code) => exits.push(code));
    return { helper, lines, exits };
};

const until = async (condition: () => boolean, label: string): Promise<void> => {
    const deadline = Date.now() + 5000;

    while (!condition()) {
        if (Date.now() > deadline) {
            throw new Error(`Timed out waiting for ${label}.`);
        }

        await new Promise((resolve) => setTimeout(resolve, 5));
    }
};

describe('spawnHelper', () => {
    test('writes a line with its break and reads the answer', async () => {
        const { helper, lines } = launch();
        helper.write('one');
        helper.write('two');
        await until(() => lines.length === 2, 'two lines');
        expect(lines).toEqual(['echo:one', 'echo:two']);
        helper.kill();
    });

    test('reads a line of megabytes that arrives in chunks', async () => {
        const { helper, lines } = launch();
        helper.write('big');
        helper.write('after');
        await until(() => lines.length === 2, 'the big line and the next');
        expect(lines[0]!.length).toBe(3000000);
        expect(lines[1]).toBe('echo:after');
        helper.kill();
    });

    test('joins a line that is split over chunks, drops carriage returns and empty lines', async () => {
        const { helper, lines } = launch();
        helper.write('split');
        await until(() => lines.length === 2, 'two lines');
        expect(lines).toEqual(['abcd', 'efgh']);
        helper.kill();
    });

    test('keeps a character whose bytes arrive apart', async () => {
        const { helper, lines } = launch();
        helper.write('multibyte');
        await until(() => lines.length === 1, 'a line');
        expect(lines[0]).toBe('é');
        helper.kill();
    });

    test('forwards stderr lines to onLog', async () => {
        const logs: string[] = [];
        const { helper, lines } = launch({ onLog: (line) => logs.push(line) });
        helper.write('err');
        await until(() => lines.length === 1 && logs.length === 2, 'the log lines');
        expect(logs).toEqual(['oops', 'second']);
        helper.kill();
    });

    test('passes the environment and the arguments', async () => {
        const { helper, lines } = launch({ env: { HELPER_TEST: 'yes' }, args: ['--flag'] });
        helper.write('env');
        await until(() => lines.length === 1, 'a line');
        expect(lines[0]).toContain('yes');
        expect(lines[0]).toContain('--flag');
        helper.kill();
    });

    test('reports the exit once, after the last line, with the code', async () => {
        const { helper, lines, exits } = launch();
        helper.write('exit');
        await until(() => exits.length === 1, 'the exit');
        expect(lines).toEqual(['bye']);
        expect(exits).toEqual([3]);
        helper.kill();
        helper.write('ignored');
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(exits).toEqual([3]);
    });

    test('delivers a last line that has no break', async () => {
        const { helper, lines, exits } = launch();
        helper.write('tail');
        await until(() => exits.length === 1, 'the exit');
        expect(lines).toEqual(['no-newline']);
        helper.kill();
    });

    test('kill is idempotent and ends the process', async () => {
        const { helper, exits } = launch();
        helper.kill();
        helper.kill();
        await until(() => exits.length === 1, 'the exit');
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(exits).toHaveLength(1);
    });

    test('reports an exit to a listener that comes late', async () => {
        const { helper, exits } = launch();
        helper.write('exit');
        await until(() => exits.length === 1, 'the exit');
        const late: (number | null)[] = [];
        helper.onExit((code) => late.push(code));
        await until(() => late.length === 1, 'the late exit');
        expect(late).toEqual([3]);
    });

    test('exits once when the binary does not exist', async () => {
        const logs: string[] = [];
        const helper = spawnHelper('/nonexistent/helper-binary', { onLog: (line) => logs.push(line) });
        const exits: (number | null)[] = [];
        helper.onExit((code) => exits.push(code));
        await until(() => exits.length === 1, 'the exit');
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(exits).toEqual([null]);
        expect(logs.join(' ')).toMatch(/ENOENT|no such file|not found/i);
        helper.write('nobody listens');
        helper.kill();
    });
});
