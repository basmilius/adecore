import { posix, win32 } from 'node:path';
import { scheduledTaskMarker, scheduledTaskScriptName } from './cmd-line.js';
import { scheduledTaskScript } from './definitions.js';

export interface CommandResult {
    code: number;
    stdout: string;
    stderr: string;
}

/* Runs a command to completion, bounded by a timeout. Synchronous, because quitting cannot wait on a promise. */
export type CommandRunner = (command: string, args: string[]) => CommandResult;

export interface ServiceFiles {
    read(path: string): string | null;
    write(path: string, text: string): void;
    remove(path: string): void;
    /* With every parent, and nothing when it is there already. */
    makeDirectory(path: string): void;
}

export interface ServiceManager {
    readonly kind: 'launchd' | 'systemd' | 'task-scheduler';
    /* The definition's file. */
    readonly path: string;
    isInstalled(): boolean;
    /* The definition on disk, null when there is none. */
    read(): string | null;
    /*
     * Puts the definition on disk, so the service starts with the person's session. A running daemon
     * keeps running, on the definition it was started from: true says that one is not this one.
     */
    install(definition: string): boolean;
    /* Starts the daemon from the definition on disk; nothing when it already runs. */
    start(): void;
    /* Ends the running daemon and starts it from the definition on disk, which is how a new binary takes over. */
    restart(): Promise<void>;
    /* Ends the running daemon. The definition stays. */
    stop(): void;
    /* Takes the definition away, so nothing starts it again. A running daemon keeps running until `stop`. */
    uninstall(): void;
    /* Linux only: whether the person's services outlive their session, and the step that makes them. */
    linger?: { enabled(): boolean; enable(): void };
}

function expectSuccess(result: CommandResult, what: string): void {
    if (result.code !== 0) {
        throw new Error(`${what} failed (${result.code}): ${(result.stderr || result.stdout).trim() || 'no output'}`);
    }
}

/* Writes the definition when it differs and returns the one it replaces. */
function writeDefinition(files: ServiceFiles, path: string, definition: string): string | null {
    const previous = files.read(path);

    if (previous !== definition) {
        files.write(path, definition);
    }

    return previous;
}

async function waitWhile(condition: () => boolean, sleep: (ms: number) => Promise<void>): Promise<void> {
    for (let attempt = 0; attempt < 25 && condition(); attempt++) {
        await sleep(200);
    }
}

export interface LaunchdOptions {
    uid: number;
    home: string;
    run: CommandRunner;
    files: ServiceFiles;
    sleep(ms: number): Promise<void>;
    label: string;
    logFile: string;
}

/*
 * A plist in ~/Library/LaunchAgents, loaded into the person's GUI domain. Not SMAppService: it wants a
 * plist sealed inside the bundle, where the login shell's PATH and a log path in the home cannot go.
 */
export function launchdManager(options: LaunchdOptions): ServiceManager {
    const path = posix.join(options.home, 'Library', 'LaunchAgents', `${options.label}.plist`);
    const domain = `gui/${options.uid}`;
    const target = `${domain}/${options.label}`;

    const launchctl = (...args: string[]): CommandResult => options.run('/bin/launchctl', args);

    const isLoaded = (): boolean => launchctl('print', target).code === 0;

    const bootstrap = (): void => {
        expectSuccess(launchctl('bootstrap', domain, path), 'launchctl bootstrap');
    };

    return {
        kind: 'launchd',
        path,
        isInstalled: () => options.files.read(path) !== null,
        read: () => options.files.read(path),
        install(definition) {
            // launchd opens the log but makes no folder for it, and a job whose log cannot open never starts.
            options.files.makeDirectory(posix.dirname(options.logFile));
            const previous = writeDefinition(options.files, path, definition);

            return previous !== null && previous !== definition;
        },
        start() {
            if (isLoaded()) {
                expectSuccess(launchctl('kickstart', target), 'launchctl kickstart');

                return;
            }

            bootstrap();
        },
        async restart() {
            if (isLoaded()) {
                launchctl('bootout', target);
                // bootout returns before the label is released; bootstrapping sooner fails with an I/O error.
                await waitWhile(isLoaded, options.sleep);
            }

            bootstrap();
        },
        stop() {
            if (isLoaded()) {
                launchctl('bootout', target);
            }
        },
        uninstall() {
            options.files.remove(path);
        }
    };
}

export interface SystemdOptions {
    configHome: string;
    run: CommandRunner;
    files: ServiceFiles;
    user: string;
    unitName: string;
}

/* A user unit under ~/.config/systemd/user, enabled for `default.target`. */
export function systemdManager(options: SystemdOptions): ServiceManager {
    const unit = options.unitName;
    const path = posix.join(options.configHome, 'systemd', 'user', unit);

    const systemctl = (...args: string[]): CommandResult => options.run('systemctl', ['--user', ...args]);

    const reload = (): void => {
        expectSuccess(systemctl('daemon-reload'), 'systemctl daemon-reload');
    };

    return {
        kind: 'systemd',
        path,
        isInstalled: () => options.files.read(path) !== null,
        read: () => options.files.read(path),
        install(definition) {
            const previous = options.files.read(path);

            if (previous !== definition) {
                options.files.write(path, definition);
                reload();
            }

            expectSuccess(systemctl('enable', unit), 'systemctl enable');

            return previous !== null && previous !== definition;
        },
        start() {
            expectSuccess(systemctl('start', unit), 'systemctl start');
        },
        async restart() {
            reload();
            expectSuccess(systemctl('restart', unit), 'systemctl restart');
        },
        stop() {
            systemctl('stop', unit);
        },
        uninstall() {
            systemctl('disable', unit);
            options.files.remove(path);
            // A running unit stays loaded without its file, so `stop` still reaches it afterwards.
            systemctl('daemon-reload');
        },
        linger: {
            enabled: () => options.run('loginctl', ['show-user', options.user, '--property=Linger', '--value']).stdout.trim() === 'yes',
            enable() {
                expectSuccess(options.run('loginctl', ['enable-linger', options.user]), 'loginctl enable-linger');
            }
        }
    };
}

export interface TaskSchedulerOptions {
    /* The name of the task, which has to be the label of the spec: a stop finds the task's processes by it. */
    taskName: string;
    /* Where the definition is kept and registered from. */
    definitionFile: string;
    logFile: string;
    run: CommandRunner;
    files: ServiceFiles;
    sleep(ms: number): Promise<void>;
}

/*
 * A task in the person's own Task Scheduler library, which takes no admin. The task runs again every
 * minute, so a stop also disables it and a start enables it again.
 */
export function taskSchedulerManager(options: TaskSchedulerOptions): ServiceManager {
    const path = options.definitionFile;
    const name = options.taskName;

    const schtasks = (...args: string[]): CommandResult => options.run('schtasks.exe', args);

    const exists = (): boolean => schtasks('/Query', '/TN', name).code === 0;

    // schtasks writes the state in the language of the system; PowerShell names it the same everywhere.
    const isRunning = (): boolean =>
        options
            .run('powershell.exe', [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                `(Get-ScheduledTask -TaskPath '\\' -TaskName '${name.replace(/'/g, "''")}' -ErrorAction Stop).State`
            ])
            .stdout.trim() === 'Running';

    // Before `/End`, which leaves what the task's cmd.exe started running without a parent to find it by.
    const endTree = (): void => {
        const marker = scheduledTaskMarker(name).replace(/'/g, "''");
        const scriptName = scheduledTaskScriptName(name);

        const script = [
            'Get-CimInstance Win32_Process -Filter "Name=\'cmd.exe\'"',
            `Where-Object { $_.CommandLine -and ($_.CommandLine.Contains('${scriptName}') -or $_.CommandLine.Contains('${marker}')) }`,
            'ForEach-Object { taskkill.exe /PID $_.ProcessId /T /F | Out-Null }'
        ].join(' | ');

        options.run('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')]);
    };

    const run = (): void => {
        expectSuccess(schtasks('/Change', '/TN', name, '/ENABLE'), 'schtasks /Change /ENABLE');
        expectSuccess(schtasks('/Run', '/TN', name), 'schtasks /Run');
    };

    return {
        kind: 'task-scheduler',
        path,
        isInstalled: () => options.files.read(path) !== null && exists(),
        read: () => options.files.read(path),
        install(definition) {
            // cmd.exe appends to the log but makes no folder for it, and the task ends at once without one.
            options.files.makeDirectory(win32.dirname(options.logFile));
            const previous = writeDefinition(options.files, path, definition);
            const script = scheduledTaskScript(definition);

            if (script !== null && options.files.read(script.path) !== script.text) {
                options.files.write(script.path, script.text);
            }

            if (previous !== definition || !exists()) {
                expectSuccess(schtasks('/Create', '/TN', name, '/XML', path, '/F'), 'schtasks /Create');
            }

            return previous !== null && previous !== definition;
        },
        start: run,
        async restart() {
            if (isRunning()) {
                endTree();
                schtasks('/End', '/TN', name);
                // A task that still counts as running ignores the next start.
                await waitWhile(isRunning, options.sleep);
            }

            run();
        },
        stop() {
            endTree();
            // schtasks ends no instance of a task that is disabled already.
            schtasks('/End', '/TN', name);
            schtasks('/Change', '/TN', name, '/DISABLE');
        },
        uninstall() {
            schtasks('/Delete', '/TN', name, '/F');
            const script = scheduledTaskScript(options.files.read(path) ?? '');

            if (script !== null) {
                options.files.remove(script.path);
            }

            options.files.remove(path);
        }
    };
}
