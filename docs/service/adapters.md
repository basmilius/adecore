# Adapters and testing

A manager never runs a command or touches a file itself. It calls the two adapters it gets: a `CommandRunner` for `launchctl`, `systemctl`, `loginctl`, `schtasks` and PowerShell, and a `ServiceFiles` for the definition. The app passes the real ones; a test passes fakes.

```ts
import { diskFiles, runCommand } from '@adecore/service/system';
import type { CommandResult, CommandRunner, ServiceFiles } from '@adecore/service/manager';
```

## CommandRunner

A `CommandRunner` is `(command, args) => CommandResult`, where `CommandResult` is `{ code, stdout, stderr }`. It is synchronous so a service can stop while the app quits, when no promise is awaited any more.

`runCommand` is the real one. It uses `spawnSync` without a shell, hides the console window on Windows and stops a command after 15 seconds, so a hung one cannot hold up a quit. A missing exit code becomes `1`, and a spawn error lands in `stderr`.

A runner that logs every command is a small wrapper:

```ts
const run: CommandRunner = (command, args) => {
    const result = runCommand(command, args);
    log.debug(`${command} ${args.join(' ')} exited with ${result.code}`);

    return result;
};
```

## ServiceFiles

`ServiceFiles` has `read(path)` (text or `null`), `write(path, text)`, `remove(path)` and `makeDirectory(path)`, which creates every parent and does nothing for a folder that exists.

`diskFiles` is the real one. It creates parent folders on write, and `remove` ignores a missing file. Its `read` returns `null` on any error, including a missing permission, so pass a stricter adapter where that matters.

## Testing

With a recording runner and a `Map` for files, every step runs in a test without `launchctl`, `systemctl` or a real wait:

```ts
import { launchdManager, type CommandRunner, type ServiceFiles } from '@adecore/service/manager';

const disk = new Map<string, string>();
const commands: string[][] = [];

const files: ServiceFiles = {
    read: (path) => disk.get(path) ?? null,
    write: (path, text) => {
        disk.set(path, text);
    },
    remove: (path) => {
        disk.delete(path);
    },
    makeDirectory: () => {}
};

// A nonzero exit of `launchctl print` means the label is not loaded.
const run: CommandRunner = (command, args) => {
    commands.push([command, ...args]);
    return { code: args[0] === 'print' ? 113 : 0, stdout: '', stderr: '' };
};

const manager = launchdManager({ service: { label: 'com.example.worker', logFile: '/Users/ada/Library/Logs/worker.log' }, uid: 501, home: '/Users/ada', run, files, sleep: async () => {} });
manager.install('<plist/>');
manager.start();
// commands: print, then bootstrap gui/501 /Users/ada/Library/LaunchAgents/com.example.worker.plist
```

A runner that returns a nonzero code for a command the manager checks, such as `bootstrap`, tests the error path. That step throws an `Error` that reads `<command> failed (<code>): <output>`, and the steps before it stay done. [Managers](/service/managers#servicemanager) says which steps ignore a failure.

The definitions need no adapter at all. Compare their text in a test, or snapshot it.
