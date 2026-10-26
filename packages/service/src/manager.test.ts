import { describe, expect, test } from 'bun:test';
import { launchdManager, systemdManager, taskSchedulerManager, type CommandResult, type ServiceFiles } from './manager.js';

function ok(stdout = ''): CommandResult {
    return { code: 0, stdout, stderr: '' };
}

function fakeRunner(answers: Record<string, CommandResult | CommandResult[]> = {}) {
    const calls: string[] = [];

    const run = (command: string, args: string[]): CommandResult => {
        const line = [command, ...args].join(' ');
        calls.push(line);
        const answer = answers[line];

        if (Array.isArray(answer)) {
            return answer.shift() ?? ok();
        }

        return answer ?? ok();
    };

    return { calls, run };
}

function memoryFiles() {
    const files = new Map<string, string>();
    const directories = new Set<string>();

    const api: ServiceFiles = {
        read: (path) => files.get(path) ?? null,
        write: (path, text) => void files.set(path, text),
        remove: (path) => void files.delete(path),
        makeDirectory: (path) => void directories.add(path)
    };

    return { files, directories, api };
}

async function noSleep(): Promise<void> {}

describe('launchdManager', () => {
    const PLIST = '/Users/bas/Library/LaunchAgents/com.example.worker.plist';
    const PRINT = '/bin/launchctl print gui/501/com.example.worker';
    const NOT_LOADED: CommandResult = { code: 113, stdout: '', stderr: 'Could not find service' };

    test('installs the plist in LaunchAgents and nothing else', () => {
        const runner = fakeRunner();
        const disk = memoryFiles();

        const manager = launchdManager({
            label: 'com.example.worker',
            logFile: '/Users/bas/Library/Logs/Example/worker.log',
            uid: 501,
            home: '/Users/bas',
            run: runner.run,
            files: disk.api,
            sleep: noSleep
        });

        manager.install('<plist/>');
        expect(disk.files.get(PLIST)).toBe('<plist/>');
        expect(manager.isInstalled()).toBe(true);
        expect(runner.calls).toEqual([]);
    });

    test('makes the folder of the log, which launchd does not and refuses to start the job without', () => {
        const disk = memoryFiles();

        const manager = launchdManager({
            label: 'com.example.worker',
            logFile: '/Users/bas/Library/Logs/Example/worker.log',
            uid: 501,
            home: '/Users/bas',
            run: fakeRunner().run,
            files: disk.api,
            sleep: noSleep
        });

        manager.install('<plist/>');
        expect([...disk.directories]).toEqual(['/Users/bas/Library/Logs/Example']);
    });

    test('starts a job that is not loaded with bootstrap, and one that is with kickstart', () => {
        const runner = fakeRunner({ [PRINT]: [NOT_LOADED, ok()] });

        const manager = launchdManager({
            label: 'com.example.worker',
            logFile: '/Users/bas/Library/Logs/Example/worker.log',
            uid: 501,
            home: '/Users/bas',
            run: runner.run,
            files: memoryFiles().api,
            sleep: noSleep
        });

        manager.start();
        manager.start();
        expect(runner.calls).toEqual([PRINT, `/bin/launchctl bootstrap gui/501 ${PLIST}`, PRINT, '/bin/launchctl kickstart gui/501/com.example.worker']);
    });

    test('restarts with a bootout, waits until launchd let go of the label, then bootstraps', async () => {
        const runner = fakeRunner({ [PRINT]: [ok(), ok(), NOT_LOADED] });

        const manager = launchdManager({
            label: 'com.example.worker',
            logFile: '/Users/bas/Library/Logs/Example/worker.log',
            uid: 501,
            home: '/Users/bas',
            run: runner.run,
            files: memoryFiles().api,
            sleep: noSleep
        });

        await manager.restart();
        expect(runner.calls).toEqual([PRINT, '/bin/launchctl bootout gui/501/com.example.worker', PRINT, PRINT, `/bin/launchctl bootstrap gui/501 ${PLIST}`]);
    });

    test('a refused bootstrap is an error that says why', () => {
        const runner = fakeRunner({
            [PRINT]: NOT_LOADED,
            [`/bin/launchctl bootstrap gui/501 ${PLIST}`]: { code: 5, stdout: '', stderr: 'Bootstrap failed: 5: Input/output error' }
        });

        const manager = launchdManager({
            label: 'com.example.worker',
            logFile: '/Users/bas/Library/Logs/Example/worker.log',
            uid: 501,
            home: '/Users/bas',
            run: runner.run,
            files: memoryFiles().api,
            sleep: noSleep
        });

        expect(() => manager.start()).toThrow('launchctl bootstrap failed (5): Bootstrap failed: 5: Input/output error');
    });

    test('uninstall removes the plist and leaves a running job to stop', () => {
        const runner = fakeRunner();
        const disk = memoryFiles();

        const manager = launchdManager({
            label: 'com.example.worker',
            logFile: '/Users/bas/Library/Logs/Example/worker.log',
            uid: 501,
            home: '/Users/bas',
            run: runner.run,
            files: disk.api,
            sleep: noSleep
        });

        manager.install('<plist/>');
        manager.uninstall();
        expect(disk.files.size).toBe(0);
        expect(runner.calls).toEqual([]);
        manager.stop();
        expect(runner.calls).toEqual([PRINT, '/bin/launchctl bootout gui/501/com.example.worker']);
    });
});

describe('systemdManager', () => {
    const UNIT = '/home/bas/.config/systemd/user/example-worker.service';

    test('installs the unit, reloads and enables it', () => {
        const runner = fakeRunner();
        const disk = memoryFiles();
        const manager = systemdManager({ unitName: 'example-worker.service', configHome: '/home/bas/.config', user: 'bas', run: runner.run, files: disk.api });
        manager.install('[Unit]');
        manager.install('[Unit]');
        expect(disk.files.get(UNIT)).toBe('[Unit]');
        expect(runner.calls).toEqual([
            'systemctl --user daemon-reload',
            'systemctl --user enable example-worker.service',
            'systemctl --user enable example-worker.service'
        ]);
    });

    test('uninstall disables the unit and takes the file away', () => {
        const runner = fakeRunner();
        const disk = memoryFiles();
        const manager = systemdManager({ unitName: 'example-worker.service', configHome: '/home/bas/.config', user: 'bas', run: runner.run, files: disk.api });
        disk.files.set(UNIT, '[Unit]');
        manager.uninstall();
        expect(disk.files.has(UNIT)).toBe(false);
        expect(runner.calls).toEqual(['systemctl --user disable example-worker.service', 'systemctl --user daemon-reload']);
    });

    test('lingering is read from loginctl and only enabled when asked', () => {
        const runner = fakeRunner({ 'loginctl show-user bas --property=Linger --value': ok('no\n') });

        const manager = systemdManager({
            unitName: 'example-worker.service',
            configHome: '/home/bas/.config',
            user: 'bas',
            run: runner.run,
            files: memoryFiles().api
        });

        expect(manager.linger?.enabled()).toBe(false);
        expect(runner.calls).not.toContain('loginctl enable-linger bas');
        manager.linger?.enable();
        expect(runner.calls).toContain('loginctl enable-linger bas');
    });
});

describe('taskSchedulerManager', () => {
    const FILE = 'C:\\Users\\bas\\AppData\\Local\\Example\\worker.xml';
    const QUERY = 'schtasks.exe /Query /TN Example Worker';
    const CREATE = `schtasks.exe /Create /TN Example Worker /XML ${FILE} /F`;
    const STATE = "powershell.exe -NoProfile -NonInteractive -Command (Get-ScheduledTask -TaskPath '\\' -TaskName 'Example Worker' -ErrorAction Stop).State";
    const MISSING: CommandResult = { code: 1, stdout: '', stderr: 'ERROR: The system cannot find the file specified.' };

    const isEndTree = (call: string): boolean => call.startsWith('powershell.exe -NoProfile -NonInteractive -EncodedCommand ');

    const END_TREE = 'end the tree';

    const named = (calls: string[]) => calls.map((call) => (isEndTree(call) ? END_TREE : call));

    const create = (runner: ReturnType<typeof fakeRunner>, disk = memoryFiles()) =>
        taskSchedulerManager({
            taskName: 'Example Worker',
            definitionFile: FILE,
            logFile: 'C:\\Users\\bas\\AppData\\Local\\Example\\logs\\worker.log',
            run: runner.run,
            files: disk.api,
            sleep: noSleep
        });

    test('registers the definition from its copy on disk, and again only when it changed or the task went', () => {
        const runner = fakeRunner({ [QUERY]: [ok(), MISSING] });
        const disk = memoryFiles();
        const manager = create(runner, disk);
        expect(manager.install('<Task/>')).toBe(false);
        expect(disk.files.get(FILE)).toBe('<Task/>');
        expect([...disk.directories]).toEqual(['C:\\Users\\bas\\AppData\\Local\\Example\\logs']);
        expect(manager.install('<Task/>')).toBe(false);
        expect(manager.install('<Task/>')).toBe(false);
        expect(manager.install('<Task version="2"/>')).toBe(true);
        expect(runner.calls).toEqual([CREATE, QUERY, QUERY, CREATE, CREATE]);
    });

    test('is installed only with the definition on disk and the task registered', () => {
        const runner = fakeRunner({ [QUERY]: [ok(), MISSING] });
        const disk = memoryFiles();
        const manager = create(runner, disk);
        expect(manager.isInstalled()).toBe(false);
        disk.files.set(FILE, '<Task/>');
        expect(manager.isInstalled()).toBe(true);
        expect(manager.isInstalled()).toBe(false);
    });

    test('a start enables the task, which a stop disabled, and runs it', () => {
        const runner = fakeRunner();
        const manager = create(runner);
        manager.start();
        manager.stop();

        expect(named(runner.calls)).toEqual([
            'schtasks.exe /Change /TN Example Worker /ENABLE',
            'schtasks.exe /Run /TN Example Worker',
            END_TREE,
            'schtasks.exe /End /TN Example Worker',
            'schtasks.exe /Change /TN Example Worker /DISABLE'
        ]);
    });

    test('restarts by ending the task, waiting until it no longer runs, then running it', async () => {
        const runner = fakeRunner({ [STATE]: [ok('Running\r\n'), ok('Running\r\n'), ok('Ready\r\n')] });
        await create(runner).restart();

        expect(named(runner.calls)).toEqual([
            STATE,
            END_TREE,
            'schtasks.exe /End /TN Example Worker',
            STATE,
            STATE,
            'schtasks.exe /Change /TN Example Worker /ENABLE',
            'schtasks.exe /Run /TN Example Worker'
        ]);
    });

    test('ends the tree under the cmd.exe whose title is the task name, which schtasks /End leaves running', () => {
        const runner = fakeRunner();
        create(runner).stop();
        const call = runner.calls.find(isEndTree)!;
        const script = Buffer.from(call.split(' ').at(-1)!, 'base64').toString('utf16le');
        expect(script).toContain("Name='cmd.exe'");
        expect(script).toContain(".Contains('title Example^ Worker && ')");
        expect(script).toContain('taskkill.exe /PID $_.ProcessId /T /F');
    });

    test('a refused registration is an error that says why', () => {
        const runner = fakeRunner({ [CREATE]: { code: 1, stdout: '', stderr: 'ERROR: Access is denied.' } });
        expect(() => create(runner).install('<Task/>')).toThrow('schtasks /Create failed (1): ERROR: Access is denied.');
    });

    test('uninstalling deletes the task and its definition', () => {
        const runner = fakeRunner();
        const disk = memoryFiles();
        disk.files.set(FILE, '<Task/>');
        create(runner, disk).uninstall();
        expect(disk.files.has(FILE)).toBe(false);
        expect(runner.calls).toEqual(['schtasks.exe /Delete /TN Example Worker /F']);
    });
});
