import { batchEscaped, cmdEscaped, scheduledTaskScriptName } from './cmd-line.js';

export interface ServiceSpec {
    label: string;
    description: string;
    program: string;
    args: string[];
    environment: Record<string, string>;
    workingDirectory: string;
    /* launchd and the scheduled task: where stdout and stderr go. systemd has the journal. */
    logFile: string;
    /* The scheduled task only, which needs it: the account it starts for at logon, as `DOMAIN\\name`. */
    user?: string;
    /* The scheduled task only, which needs it: the folder of the script it runs. */
    scriptDirectory?: string;
}

function xmlText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function xmlValue(text: string): string {
    return text
        .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function plistString(value: string, indent: string): string {
    return `${indent}<string>${xmlText(value)}</string>`;
}

/* `ProcessType=Interactive` avoids launchd throttling during a handover to a background process. */
export function launchAgentPlist(spec: ServiceSpec): string {
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
        '<plist version="1.0">',
        '<dict>',
        '    <key>Label</key>',
        plistString(spec.label, '    '),
        '    <key>ProgramArguments</key>',
        '    <array>',
        ...[spec.program, ...spec.args].map((arg) => plistString(arg, '        ')),
        '    </array>',
        '    <key>EnvironmentVariables</key>',
        '    <dict>'
    ];

    for (const [name, value] of Object.entries(spec.environment)) {
        lines.push(`        <key>${xmlText(name)}</key>`, plistString(value, '        '));
    }

    lines.push(
        '    </dict>',
        '    <key>WorkingDirectory</key>',
        plistString(spec.workingDirectory, '    '),
        '    <key>RunAtLoad</key>',
        '    <true/>',
        '    <key>KeepAlive</key>',
        '    <true/>',
        '    <key>ProcessType</key>',
        '    <string>Interactive</string>',
        '    <key>StandardOutPath</key>',
        plistString(spec.logFile, '    '),
        '    <key>StandardErrorPath</key>',
        plistString(spec.logFile, '    '),
        '</dict>',
        '</plist>',
        ''
    );

    return lines.join('\n');
}

/* systemd expands `%` specifiers everywhere and `$` variables in a command line, so both are doubled; quotes keep a space in a path. */
function unitWord(value: string, command: boolean): string {
    let escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/%/g, '%%');

    if (command) {
        escaped = escaped.replace(/\$/g, '$$$$');
    }

    return `"${escaped}"`;
}

/* User services stop at logout unless the caller enables lingering. */
export function systemdUnit(spec: ServiceSpec): string {
    const lines = [
        '[Unit]',
        `Description=${spec.description.replace(/%/g, '%%')}`,
        '',
        '[Service]',
        'Type=simple',
        `ExecStart=${[spec.program, ...spec.args].map((word) => unitWord(word, true)).join(' ')}`,
        ...Object.entries(spec.environment).map(([name, value]) => `Environment=${unitWord(`${name}=${value}`, false)}`),
        // The one setting here that takes no quotes: it reads the rest of the line as the path.
        `WorkingDirectory=${spec.workingDirectory.replace(/%/g, '%%')}`,
        'Restart=always',
        'RestartSec=2',
        '',
        '[Install]',
        'WantedBy=default.target',
        ''
    ];

    return lines.join('\n');
}

/* One argument as the C runtime splits a command line, escaped so cmd.exe passes it on as it is. */
function cmdArgument(arg: string): string {
    if (/[\r\n]/.test(arg)) {
        throw new Error('A scheduled task cannot pass on a line break');
    }

    return batchEscaped(`"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1')}"`);
}

/* In quotes of its own, or the C runtime of the program splits its own path at a space, whatever the carets told cmd.exe. */
function batchProgram(program: string): string {
    return batchEscaped(`"${program}"`);
}

/* The code page first, or cmd.exe reads the UTF-8 of a path outside the system's code page as something else. */
function taskScript(spec: ServiceSpec): string {
    const variables = Object.entries(spec.environment).map(([name, value]) => `set ${batchEscaped(`"${name}=${value}"`)}`);
    const program = [batchProgram(spec.program), ...spec.args.map(cmdArgument)].join(' ');
    const lines = [
        '@echo off',
        'chcp 65001 >nul',
        `cd /d ${batchEscaped(spec.workingDirectory)} || exit /b 1`,
        ...variables,
        `${program} >>${batchEscaped(spec.logFile)} 2>&1`
    ];

    if (lines.some((line) => /[\r\n]/.test(line))) {
        throw new Error('A scheduled task cannot pass on a line break');
    }

    return `${lines.join('\r\n')}\r\n`;
}

/*
 * Started at the person's logon without a stored password, and run again every minute so it comes back
 * after a crash. RestartOnFailure would also start a task a stop ended.
 *
 * A task with an interactive token gives a console program a window, and closing that ends it. Only a
 * headless conhost.exe shows none, but it joins its arguments again and loses every inner quote. So
 * what needs quoting moves into a script, which the task starts from its own folder by a bare name.
 * The definition carries the script in `Documentation`, and a manager writes it out on install.
 */
export function scheduledTask(spec: ServiceSpec): string {
    if (spec.user === undefined || spec.user === '') {
        throw new Error('A scheduled task needs the user it starts for.');
    }

    if (spec.scriptDirectory === undefined || spec.scriptDirectory === '') {
        throw new Error('A scheduled task needs the folder of its script.');
    }

    const user = xmlText(spec.user);

    // No XML declaration: schtasks decodes the file itself and refuses one that names an encoding.
    const lines = [
        '<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
        '  <RegistrationInfo>',
        `    <Description>${xmlText(spec.description)}</Description>`,
        `    <URI>\\${xmlText(spec.label)}</URI>`,
        `    <Documentation>${xmlText(taskScript(spec))}</Documentation>`,
        '  </RegistrationInfo>',
        '  <Triggers>',
        '    <LogonTrigger>',
        '      <Enabled>true</Enabled>',
        `      <UserId>${user}</UserId>`,
        '      <Repetition>',
        '        <Interval>PT1M</Interval>',
        '        <StopAtDurationEnd>false</StopAtDurationEnd>',
        '      </Repetition>',
        '    </LogonTrigger>',
        '  </Triggers>',
        '  <Principals>',
        '    <Principal id="Author">',
        `      <UserId>${user}</UserId>`,
        '      <LogonType>InteractiveToken</LogonType>',
        '      <RunLevel>LeastPrivilege</RunLevel>',
        '    </Principal>',
        '  </Principals>',
        '  <Settings>',
        '    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>',
        '    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>',
        '    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>',
        '    <AllowHardTerminate>true</AllowHardTerminate>',
        '    <StartWhenAvailable>true</StartWhenAvailable>',
        '    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>',
        '    <IdleSettings>',
        '      <StopOnIdleEnd>false</StopOnIdleEnd>',
        '      <RestartOnIdle>false</RestartOnIdle>',
        '    </IdleSettings>',
        '    <AllowStartOnDemand>true</AllowStartOnDemand>',
        '    <Enabled>true</Enabled>',
        '    <Hidden>false</Hidden>',
        '    <RunOnlyIfIdle>false</RunOnlyIfIdle>',
        '    <WakeToRun>false</WakeToRun>',
        // The default ends a task after three days.
        '    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>',
        // The default, 7, runs a task below normal priority.
        '    <Priority>5</Priority>',
        '  </Settings>',
        '  <Actions Context="Author">',
        '    <Exec>',
        '      <Command>%SystemRoot%\\System32\\conhost.exe</Command>',
        `      <Arguments>--headless cmd.exe /d /c .\\${scheduledTaskScriptName(spec.label)}</Arguments>`,
        `      <WorkingDirectory>${xmlText(spec.scriptDirectory)}</WorkingDirectory>`,
        '    </Exec>',
        '  </Actions>',
        '</Task>',
        ''
    ];

    // ASCII with character references: schtasks reads a UTF-8 file as the system's code page, and refuses a BOM.
    return lines.join('\r\n').replace(/[\u0080-\u{10ffff}]/gu, (character) => `&#${character.codePointAt(0)};`);
}

/* The script a definition starts, null for any other definition and for a task from before it had one. */
export function scheduledTaskScript(definition: string): { path: string; text: string } | null {
    const text = /<Documentation>([^<]*)<\/Documentation>/.exec(definition)?.[1];
    const name = /<Arguments>--headless cmd\.exe \/d \/c \.\\([^<]+)<\/Arguments>/.exec(definition)?.[1];
    const folder = /<WorkingDirectory>([^<]*)<\/WorkingDirectory>/.exec(definition)?.[1];

    if (text === undefined || name === undefined || folder === undefined) {
        return null;
    }

    return { path: `${xmlValue(folder).replace(/\\$/, '')}\\${name}`, text: xmlValue(text) };
}

function scheduledTaskRunsProgram(definition: string, program: string): boolean {
    const script = scheduledTaskScript(definition);

    if (script !== null) {
        return (script.text.trimEnd().split('\r\n').at(-1) ?? '').startsWith(`${batchProgram(program)} `);
    }

    // A task from before the script: its one line ends in the program.
    const exec = definition.match(/<Exec>[\s\S]*?<\/Exec>/g);

    if (exec?.length !== 1) {
        return false;
    }

    const args = /<Arguments>([^<]*)<\/Arguments>/.exec(exec[0])?.[1];
    const line = args === undefined ? undefined : /\/c "([\s\S]*)"$/.exec(xmlValue(args))?.[1];

    return line !== undefined && (line.split(' && ').at(-1) ?? '').startsWith(`${cmdEscaped(program)} `);
}

/* Only keys of the outer plist dictionary identify the executable; nested environment keys are data. */
function launchAgentProgram(definition: string): string | null {
    const xml = definition.replace(/<!--[\s\S]*?-->/g, '');

    if (xml.includes('<!--')) {
        return null;
    }

    const entries = new Map<string, string>();
    let depth = 0;
    let key: string | null = null;
    let start = 0;

    const close = (end: number): void => {
        if (key !== null) {
            entries.set(key, xml.slice(start, end));
        }
    };

    for (const token of xml.matchAll(/<(\/?)(dict|array)\s*>|<key>([^<]*)<\/key>/g)) {
        if (token[3] !== undefined) {
            if (depth !== 1) {
                continue;
            }

            close(token.index);
            key = token[3];

            if (entries.has(key)) {
                return null;
            }

            start = token.index + token[0].length;
        } else if (token[1] === '') {
            depth++;
        } else {
            depth--;

            if (depth === 0) {
                close(token.index);
                const program = entries.get('Program');

                return program !== undefined
                    ? (/^\s*<string>([^<]*)<\/string>\s*$/.exec(program)?.[1] ?? null)
                    : (/^\s*<array>\s*<string>([^<]*)<\/string>/.exec(entries.get('ProgramArguments') ?? '')?.[1] ?? null);
            }
        }
    }

    return null;
}

function systemdRunsProgram(definition: string, program: string): boolean {
    let service = false;
    let commands: string[] = [];

    for (const raw of definition.split('\n')) {
        const line = raw.trim();

        if (line.startsWith('#') || line.startsWith(';')) {
            continue;
        }

        if (/^\[.*\]$/.test(line)) {
            service = line === '[Service]';

            continue;
        }

        const command = service ? /^ExecStart\s*=\s*(.*)$/.exec(line)?.[1] : undefined;

        if (command !== undefined) {
            if (command === '') {
                commands = [];
            } else {
                commands.push(command);
            }
        }
    }

    const executable = unitWord(program, true);

    return commands.length > 0 && commands.every((command) => command === executable || command.startsWith(`${executable} `));
}

/* Callers sharing a service identity can check executable ownership before replacing its definition. */
export function definitionRunsProgram(definition: string, program: string): boolean {
    if (/<Task[\s>]/.test(definition)) {
        return scheduledTaskRunsProgram(definition, program);
    }

    return definition.trimStart().startsWith('<') ? launchAgentProgram(definition) === xmlText(program) : systemdRunsProgram(definition, program);
}
