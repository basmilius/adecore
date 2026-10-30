import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { scheduledTask } from './definitions.js';
import { taskSchedulerManager } from './manager.js';
import { diskFiles, runCommand } from './system.js';

// It registers a real task for the person who runs it, so only a run that asks for it does.
const enabled = process.platform === 'win32' && process.env.ADECORE_TEST_TASK_SCHEDULER === '1';

function alive(pid: number): boolean {
    return runCommand('tasklist.exe', ['/FI', `PID eq ${pid}`, '/NH', '/FO', 'CSV']).stdout.includes(`"${pid}"`);
}

// Every bun and cmd process with its parent, for a failure to show what is left running.
function processes(): string {
    return runCommand('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='bun.exe' or Name='cmd.exe'\" | Format-Table ProcessId,ParentProcessId,CommandLine -AutoSize -Wrap | Out-String -Width 400"
    ]).stdout;
}

describe.skipIf(!enabled)('a scheduled task on Windows', () => {
    test('starts with its environment, restarts, stops with what it started and goes', async () => {
        const folder = mkdtempSync(join(tmpdir(), 'task scheduler '));
        // Apart from the folder the task works in, so a report outlives a failed removal of that one.
        const reports = mkdtempSync(join(tmpdir(), 'task-reports-'));
        const steps: string[] = [];

        const step = (name: string): void => void steps.push(`${Date.now()} ${name}`);

        const logFile = join(folder, 'log folder', 'worker.log');
        const taskName = `adecore-test-${process.pid}`;
        const value = 'a b & c %PATH% ^d! "e"';

        writeFileSync(
            join(folder, 'worker.js'),
            [
                "const { mkdirSync, writeFileSync } = require('node:fs');",
                `mkdirSync(${JSON.stringify(reports)}, { recursive: true });`,
                `writeFileSync(require('node:path').join(${JSON.stringify(reports)}, process.pid + '.json'), JSON.stringify({ pid: process.pid, at: Date.now(), value: process.env.EXAMPLE_VALUE, cwd: process.cwd() }));`,
                "console.log('worker started');",
                'setInterval(() => undefined, 1000);',
                ''
            ].join('\n')
        );

        const manager = taskSchedulerManager({
            taskName,
            definitionFile: join(folder, 'task.xml'),
            logFile,
            run: runCommand,
            files: diskFiles,
            sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
        });

        const started = (): Array<{ pid: number; at: number; value: string; cwd: string }> => {
            try {
                return readdirSync(reports).map((name) => JSON.parse(readFileSync(join(reports, name), 'utf8')));
            } catch {
                return [];
            }
        };

        const until = async (done: () => boolean, what: string): Promise<void> => {
            const deadline = Date.now() + 30_000;

            while (!done() && Date.now() < deadline) {
                await new Promise((resolve) => setTimeout(resolve, 250));
            }

            if (!done()) {
                const log = (() => {
                    try {
                        return readFileSync(logFile, 'utf8');
                    } catch {
                        return '(no log)';
                    }
                })();

                const query = runCommand('schtasks.exe', ['/Query', '/TN', taskName, '/V', '/FO', 'LIST']);

                throw new Error(
                    `${what} did not happen.\nLog:\n${log}\nTask:\n${query.stdout}${query.stderr}\nSteps:\n${steps.join('\n')}\nStarted:\n${JSON.stringify(started())}\nProcesses:\n${processes()}`
                );
            }
        };

        try {
            const definition = scheduledTask({
                label: taskName,
                description: 'A test of @adecore/service',
                program: process.execPath,
                args: [join(folder, 'worker.js')],
                environment: { EXAMPLE_VALUE: value },
                workingDirectory: folder,
                logFile,
                user: `${process.env.USERDOMAIN}\\${process.env.USERNAME}`,
                scriptDirectory: folder
            });

            expect(manager.install(definition)).toBe(false);
            expect(manager.isInstalled()).toBe(true);

            step('start');
            manager.start();
            await until(() => started().length === 1, 'The first start');
            const [first] = started();
            expect(first!.value).toBe(value);
            expect(first!.cwd.toLowerCase()).toBe(folder.toLowerCase());
            expect(readFileSync(logFile, 'utf8')).toContain('worker started');

            step('restart');
            await manager.restart();
            step('restarted');
            await until(() => started().length === 2, 'The restart');
            await until(() => !alive(first!.pid), 'The end of the first worker');
            const second = started().find((report) => report.pid !== first!.pid)!;
            expect(alive(second.pid)).toBe(true);

            step('stop');
            manager.stop();
            await until(() => !alive(second.pid), 'The stop');
            step('stopped');
        } finally {
            manager.stop();
            manager.uninstall();
            step('uninstalled');

            // The ended task lets go of its working folder a moment later.
            await until(() => {
                try {
                    rmSync(folder, { recursive: true, force: true });

                    return true;
                } catch {
                    return false;
                }
            }, 'Removing the folder');

            rmSync(reports, { recursive: true, force: true });
        }

        expect(manager.isInstalled()).toBe(false);
    }, 120_000);
});
