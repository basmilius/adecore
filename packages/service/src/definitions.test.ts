import { describe, expect, test } from 'bun:test';
import { definitionRunsProgram, launchAgentPlist, scheduledTask, systemdUnit, type ServiceSpec } from './definitions.js';

const MAC: ServiceSpec = {
    label: 'com.example.worker',
    description: 'Example worker',
    program: '/Applications/Example.app/Contents/Resources/bin/worker',
    args: ['--port', '4210', '--serve', '/Applications/Example.app/Contents/Resources/client'],
    environment: { WORKER_HOME: '/Users/bas/.worker', PATH: '/opt/homebrew/bin:/usr/bin:/bin' },
    workingDirectory: '/Users/bas',
    logFile: '/Users/bas/Library/Logs/Example/daemon.log'
};

const LINUX: ServiceSpec = {
    label: 'com.example.worker',
    description: 'Example worker',
    program: '/opt/Example/resources/bin/worker',
    args: ['--port', '4210', '--serve', '/opt/Example/resources/client'],
    environment: { WORKER_HOME: '/home/bas/.worker', PATH: '/home/bas/.local/bin:/usr/bin:/bin' },
    workingDirectory: '/home/bas',
    logFile: '/home/bas/.config/Example/logs/daemon.log'
};

const WINDOWS: ServiceSpec = {
    label: 'Example Worker',
    description: 'Example worker',
    program: 'C:\\Users\\bas\\AppData\\Local\\Programs\\Example\\resources\\bin\\worker.exe',
    args: ['--port', '4210'],
    environment: { WORKER_HOME: 'C:\\Users\\bas\\.worker', PATH: 'C:\\Program Files\\Git\\cmd;C:\\Windows\\System32' },
    workingDirectory: 'C:\\Users\\bas',
    logFile: 'C:\\Users\\bas\\AppData\\Local\\Example\\logs\\daemon.log',
    user: 'DESKTOP-1\\bas'
};

function taskArguments(definition: string): string {
    return /<Arguments>([^<]*)<\/Arguments>/.exec(definition)![1]!.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

describe('scheduledTask', () => {
    test('the task of a packaged app', () => {
        expect(scheduledTask(WINDOWS)).toMatchSnapshot();
    });

    test('starts for the one user at logon, in their session, and never stores a password', () => {
        const task = scheduledTask(WINDOWS);
        expect(task).toContain('<LogonTrigger>\r\n      <Enabled>true</Enabled>\r\n      <UserId>DESKTOP-1\\bas</UserId>');
        expect(task).toContain('<LogonType>InteractiveToken</LogonType>');
        expect(task).toContain('<RunLevel>LeastPrivilege</RunLevel>');
        expect(task).toContain('<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>');
        expect(task).toContain('<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>');
    });

    test('sets the environment, runs the program and appends to the log through cmd.exe', () => {
        expect(taskArguments(scheduledTask(WINDOWS))).toBe(
            '/d /s /c "' +
                'title Example^ Worker && ' +
                'set ^"WORKER_HOME=C:\\Users\\bas\\.worker^" && ' +
                'set ^"PATH=C:\\Program^ Files\\Git\\cmd^;C:\\Windows\\System32^" && ' +
                'C:\\Users\\bas\\AppData\\Local\\Programs\\Example\\resources\\bin\\worker.exe ^"--port^" ^"4210^" ' +
                '>>C:\\Users\\bas\\AppData\\Local\\Example\\logs\\daemon.log 2>&1"'
        );
    });

    test('escapes what cmd.exe and XML would read as syntax', () => {
        const task = scheduledTask({ ...WINDOWS, args: ['a "b" & c', '100%', 'C:\\dir\\'], environment: {}, workingDirectory: 'C:\\a&b' });
        expect(taskArguments(task)).toContain('^"a^ \\^"b\\^"^ ^&^ c^" ^"100^%^" ^"C:\\dir\\\\^"');
        expect(task).toContain('<WorkingDirectory>C:\\a&amp;b</WorkingDirectory>');
    });

    test('needs the user it starts for, and refuses a line break cmd.exe would cut at', () => {
        expect(() => scheduledTask({ ...WINDOWS, user: undefined })).toThrow('needs the user');
        expect(() => scheduledTask({ ...WINDOWS, args: ['a\nb'] })).toThrow('line break');
    });

    test('tells a task that runs a program from one that runs another', () => {
        expect(definitionRunsProgram(scheduledTask(WINDOWS), WINDOWS.program)).toBe(true);
        expect(definitionRunsProgram(scheduledTask({ ...WINDOWS, args: [] }), WINDOWS.program)).toBe(true);
        expect(definitionRunsProgram(scheduledTask({ ...WINDOWS, program: `${WINDOWS.program}.old` }), WINDOWS.program)).toBe(false);
        expect(definitionRunsProgram(scheduledTask({ ...WINDOWS, program: 'C:\\other.exe', args: [WINDOWS.program] }), WINDOWS.program)).toBe(false);
        expect(definitionRunsProgram(scheduledTask({ ...WINDOWS, program: 'C:\\other.exe', environment: { WORKER: WINDOWS.program } }), WINDOWS.program)).toBe(
            false
        );
    });
});

describe('launchAgentPlist', () => {
    test('the LaunchAgent of a packaged app', () => {
        expect(launchAgentPlist(MAC)).toMatchSnapshot();
    });

    test('escapes what XML would read as markup', () => {
        const plist = launchAgentPlist({ ...MAC, workingDirectory: '/Users/a&b/<x>' });
        expect(plist).toContain('<string>/Users/a&amp;b/&lt;x&gt;</string>');
    });
});

describe('systemdUnit', () => {
    test('the user unit of a packaged app', () => {
        expect(systemdUnit(LINUX)).toMatchSnapshot();
    });

    test('quotes a space and doubles what systemd would expand', () => {
        const unit = systemdUnit({ ...LINUX, program: '/opt/My Apps/worker', environment: { PATH: '/a%b:$HOME/bin' } });
        expect(unit).toContain('ExecStart="/opt/My Apps/worker" "--port"');
        expect(unit).toContain('Environment="PATH=/a%%b:$HOME/bin"');
    });

    test('doubles a dollar in the command line, where systemd expands variables', () => {
        const unit = systemdUnit({ ...LINUX, args: ['--label', 'a$b'] });
        expect(unit).toContain('"a$$b"');
    });
});

describe('the service of the npm package', () => {
    const NPM_MAC: ServiceSpec = {
        ...MAC,
        program: '/Users/bas/.worker/bin/worker',
        args: []
    };

    const NPM_LINUX: ServiceSpec = {
        ...LINUX,
        program: '/home/bas/.worker/bin/worker',
        args: ['--host', '0.0.0.0']
    };

    test('points the LaunchAgent at the copy under the home', () => {
        const plist = launchAgentPlist(NPM_MAC);
        expect(plist).toContain('<string>/Users/bas/.worker/bin/worker</string>');
        expect(plist).not.toContain('_npx');
    });

    test('points the user unit at the copy under the home', () => {
        expect(systemdUnit(NPM_LINUX)).toContain('ExecStart="/home/bas/.worker/bin/worker" "--host" "0.0.0.0"');
    });

    test('tells a definition that runs a program from one that runs another', () => {
        expect(definitionRunsProgram(launchAgentPlist(NPM_MAC), NPM_MAC.program)).toBe(true);
        expect(definitionRunsProgram(launchAgentPlist(MAC), NPM_MAC.program)).toBe(false);
        expect(definitionRunsProgram(systemdUnit(NPM_LINUX), NPM_LINUX.program)).toBe(true);
        expect(definitionRunsProgram(systemdUnit({ ...NPM_LINUX, args: [] }), NPM_LINUX.program)).toBe(true);
        expect(definitionRunsProgram(systemdUnit(LINUX), NPM_LINUX.program)).toBe(false);
        // A path that only starts the same way is another program.
        expect(definitionRunsProgram(launchAgentPlist({ ...NPM_MAC, program: '/Users/bas/.worker/bin/worker-old' }), NPM_MAC.program)).toBe(false);
    });

    test('a launch agent runs its first program argument, not one further on or in its environment', () => {
        const other = { ...NPM_MAC, program: '/bin/other' };
        expect(definitionRunsProgram(launchAgentPlist({ ...other, args: [NPM_MAC.program] }), NPM_MAC.program)).toBe(false);
        expect(definitionRunsProgram(launchAgentPlist({ ...other, environment: { WORKER: NPM_MAC.program } }), NPM_MAC.program)).toBe(false);
        expect(definitionRunsProgram(launchAgentPlist({ ...other, workingDirectory: NPM_MAC.program }), NPM_MAC.program)).toBe(false);
    });

    test('a launch agent with a Program key runs that program', () => {
        const plist = launchAgentPlist({ ...NPM_MAC, program: '/bin/other' }).replace(
            '<key>ProgramArguments</key>',
            `<key>Program</key>\n    <string>${NPM_MAC.program}</string>\n    <key>ProgramArguments</key>`
        );

        expect(definitionRunsProgram(plist, NPM_MAC.program)).toBe(true);
        expect(definitionRunsProgram(plist, '/bin/other')).toBe(false);
    });

    test('ignores program keys in XML comments and nested dictionaries', () => {
        const other = launchAgentPlist({ ...NPM_MAC, program: '/bin/other', environment: { Program: NPM_MAC.program } });
        expect(definitionRunsProgram(other, NPM_MAC.program)).toBe(false);
        const commented = other.replace('<dict>', `<dict><!-- <key>Program</key><string>${NPM_MAC.program}</string> -->`);
        expect(definitionRunsProgram(commented, NPM_MAC.program)).toBe(false);
    });

    test('ignores a commented systemd ExecStart', () => {
        const other = systemdUnit({ ...NPM_LINUX, program: '/bin/other' });
        const commented = other.replace('[Service]', `[Service]\n#ExecStart="${NPM_LINUX.program}" `);
        expect(definitionRunsProgram(commented, NPM_LINUX.program)).toBe(false);
    });
});
