# Managers

A manager puts a definition on disk and starts, restarts and stops the service through the platform's own commands. Creating one runs nothing and registers nothing, so there is nothing to dispose.

```ts
import { launchdManager, systemdManager, type ServiceManager } from '@adecore/service/manager';
import { platformServiceManager } from '@adecore/service/platform';
import { diskFiles, runCommand } from '@adecore/service/system';
```

## ServiceManager

| Member | |
| --- | --- |
| `kind` | `'launchd'` or `'systemd'`. |
| `path` | Where the definition lives. |
| `isInstalled()` | Whether a definition is on disk. It does not look at a running process. |
| `read()` | The definition on disk, or `null`. |
| `install(definition)` | Writes the definition when it differs from the one on disk. Returns `true` only when it replaced a different one; a first install returns `false`. |
| `start()` | Starts the service from the definition on disk. |
| `restart()` | Stops the running service and starts it from the definition on disk, which is how a new definition or a new binary takes over. Returns a promise. |
| `stop()` | Stops the running service. The definition stays. |
| `uninstall()` | Removes the definition, so nothing starts the service again. A running service keeps running until `stop()`. |
| `linger` | systemd only; see [Lingering](#lingering). |

Every member but `restart` is synchronous. A manager has no queue, lock or cancellation: run one change at a time, and wait for `restart` before the next. A step that fails throws an `Error` that reads `<command> failed (<code>): <output>`; there is no error class of its own. A failing step does not undo the ones before it: a systemd `install` whose `enable` fails leaves the new unit on disk.

## launchd

`launchdManager(options)` keeps the definition at `<home>/Library/LaunchAgents/<label>.plist` and runs `/bin/launchctl` in the `gui/<uid>` domain, the session of a logged-in person.

| `LaunchdOptions` | |
| --- | --- |
| `label` | The label of the spec. |
| `uid` | The person's user id. |
| `home` | Their home folder. |
| `logFile` | The log file of the spec. `install` creates its folder, since a job whose log cannot open never starts. |
| `run` | A `CommandRunner`. |
| `files` | A `ServiceFiles`. |
| `sleep(ms)` | Resolves after `ms` milliseconds; `restart` waits with it. |

`install` writes the property list but loads nothing. `start` runs `kickstart` when the label is loaded and `bootstrap` when it is not. `restart` runs `bootout`, waits until the label is gone (25 times 200ms at most) and runs `bootstrap`, which fails when the old job still holds the label. `stop` runs `bootout` when the label is loaded and ignores its result. `uninstall` only removes the file.

## systemd

`systemdManager(options)` keeps the unit at `<configHome>/systemd/user/<unitName>` and runs `systemctl --user`.

| `SystemdOptions` | |
| --- | --- |
| `unitName` | The file name of the unit, such as `example-worker.service`. |
| `configHome` | The person's config folder, usually `~/.config`. The package reads no `XDG_CONFIG_HOME`. |
| `user` | Their user name, for `loginctl`. |
| `run` | A `CommandRunner`. |
| `files` | A `ServiceFiles`. |

`install` writes a changed unit and runs `daemon-reload`, then `enable` every time, so the unit starts at the next login. It starts nothing. `start` and `restart` run `start` and `daemon-reload` plus `restart`. `stop` runs `stop` and ignores its result. `uninstall` runs `disable`, removes the file and runs `daemon-reload`, all without checking the results.

### Lingering

A user unit stops when the person's last session ends. `manager.linger?.enabled()` asks `loginctl show-user <user> --property=Linger --value` and is true only when it prints `yes`. `manager.linger?.enable()` runs `loginctl enable-linger <user>` and throws when that fails. Nothing calls it for you, and there is no way back through the package. It changes the person's account for every user service, so ask them first.

## Picking the platform

`platformServiceManager(platform, { launchd, systemd })` returns the launchd manager on `darwin`, the systemd manager on `linux` and `null` elsewhere. `PlatformServiceOptions` needs both sets of options in full. Check for `null` before you call `serviceDefinition`, which throws on an unsupported platform.

## Adapters

A `CommandRunner` is `(command, args) => CommandResult`, where `CommandResult` is `{ code, stdout, stderr }`. It is synchronous on purpose: a service is often stopped while the app quits, and quitting cannot wait on a promise. `ServiceFiles` has `read(path)`, which returns the text or `null`, `write(path, text)`, `remove(path)` and `makeDirectory(path)`, which creates every parent.

`@adecore/service/system` holds the adapters that touch the machine. `runCommand` uses `spawnSync` without a shell, with stdin closed and a 15 second timeout per command; a missing exit code becomes `1` and a spawn error lands in `stderr`. `diskFiles` reads with `readFileSync`, creates the parent folder before it writes and removes a file with `force`. Its `read` returns `null` on any error, a missing permission included; pass a stricter adapter where that difference matters.

## Testing

Pass a runner that records each command and a `Map` for files, and every step runs in a test without `launchctl`, `systemctl` or a real wait:

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

const manager = launchdManager({ label: 'com.example.worker', uid: 501, home: '/Users/ada', logFile: '/Users/ada/Library/Logs/worker.log', run, files, sleep: async () => {} });
manager.install('<plist/>');
manager.start();
// commands: print, then bootstrap gui/501 /Users/ada/Library/LaunchAgents/com.example.worker.plist
```
