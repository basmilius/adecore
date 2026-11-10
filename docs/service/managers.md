# Managers

A manager writes a definition to disk and starts, restarts and stops the service through the platform's commands. Creating one has no side effects and needs no disposal.

```ts
import { launchdManager, systemdManager, taskSchedulerManager, type ServiceManager } from '@adecore/service/manager';
import { platformServiceManager } from '@adecore/service/platform';
import { diskFiles, runCommand } from '@adecore/service/system';
```

## ServiceManager

| Member | |
| --- | --- |
| `kind` | `'launchd'`, `'systemd'` or `'task-scheduler'`. |
| `path` | Where the definition lives. |
| `isInstalled()` | Whether a definition is on disk, not whether the service runs. |
| `read()` | The definition on disk, or `null`. |
| `install(definition)` | Writes the definition when it differs from the one on disk. Returns `true` only when it replaced a different one; a first install returns `false`. |
| `start()` | Starts the service from the definition on disk. |
| `restart()` | Stops the service and starts it from disk, so a new definition or binary takes over. Returns a promise. |
| `stop()` | Stops the service. The definition stays. |
| `uninstall()` | Removes the definition. A running service keeps running until `stop()`. |
| `linger` | systemd only; see [Lingering](#lingering). |

Every member but `restart` is synchronous. A manager has no queue or lock, so run one change at a time and await `restart`. A failed step throws an `Error` that reads `<command> failed (<code>): <output>`, and earlier steps stay done. A systemd `install` whose `enable` fails leaves the new unit on disk.

## launchd

`launchdManager(options)` keeps the definition at `<home>/Library/LaunchAgents/<label>.plist` and runs `/bin/launchctl` in the `gui/<uid>` domain.

| `LaunchdOptions` | |
| --- | --- |
| `service` | The spec of the service, or its `ServiceIdentity` (`label` and `logFile`). `install` creates the folder of the log file. |
| `uid` | The person's user id. |
| `home` | Their home folder. |
| `run` | A `CommandRunner`. |
| `files` | A `ServiceFiles`. |
| `sleep(ms)` | Resolves after `ms` milliseconds; `restart` waits with it. |

`install` writes the property list but loads nothing. `start` runs `kickstart` when the label is loaded, else `bootstrap`. `restart` runs `bootout` when the label is loaded, waits up to five seconds for the label to go and runs `bootstrap`, which throws when the old job has not exited by then. `stop` runs `bootout` when the label is loaded and ignores its result. `uninstall` only removes the file.

## systemd

`systemdManager(options)` keeps the unit at `<configHome>/systemd/user/<unitName>` and runs `systemctl --user`.

| `SystemdOptions` | |
| --- | --- |
| `unitName` | The file name of the unit, such as `example-worker.service`. |
| `configHome` | The person's config folder, usually `~/.config`. The package reads no `XDG_CONFIG_HOME`. |
| `user` | Their user name, for `loginctl`. |
| `run` | A `CommandRunner`. |
| `files` | A `ServiceFiles`. |

`install` writes a changed unit, runs `daemon-reload` and always runs `enable`, so the unit starts at the next login. It starts nothing. `start` runs `start`, and `restart` runs `daemon-reload` and `restart`. `stop` runs `stop` and ignores its result. `uninstall` runs `disable`, removes the file and runs `daemon-reload`, ignoring results.

### Lingering

A user unit stops when the person's last session ends. `manager.linger?.enabled()` is true only when `loginctl show-user <user> --property=Linger --value` prints `yes`. `manager.linger?.enable()` runs `loginctl enable-linger <user>` and throws on failure. Nothing calls it for you, and the package cannot undo it. It affects every user service of the account, so ask the person first.

## Task Scheduler

`taskSchedulerManager(options)` registers the task in the root of the person's Task Scheduler library with `schtasks.exe`, from a copy of the definition at `definitionFile`. It needs no admin rights and stores no password.

| `TaskSchedulerOptions` | |
| --- | --- |
| `service` | The spec of the service, or its `ServiceIdentity` (`label` and `logFile`). The label is the name of the task, which `stop` uses to find the processes. `install` creates the folder of the log file. |
| `definitionFile` | Where the copy of the definition lives; `path` is this file. |
| `run` | A `CommandRunner`. |
| `files` | A `ServiceFiles`. |
| `sleep(ms)` | Resolves after `ms` milliseconds; `restart` waits with it. |

```ts
const manager = taskSchedulerManager({
    service: spec,
    definitionFile: join(dataFolder, 'service', `${spec.label}.xml`),
    run: runCommand,
    files: diskFiles,
    sleep: (ms) => setTimeout(ms)
});
```

`isInstalled` is true when the copy is on disk and `schtasks /Query` finds the task. `install` writes the copy and the [script](/service/definitions#escaping) the task runs, then runs `schtasks /Create /XML /F` when the copy changed or the task is gone. It starts nothing.

`stop` kills the process tree with `taskkill /T /F`, then ends and disables the task, so it stays stopped across logons. `start` enables the task and runs it. `restart` kills the tree of a running task, waits up to five seconds for the task to stop and starts it. `uninstall` deletes the task, the script and the copy without checking the result. The manager cannot stop a deleted task, so stop it first.

## Picking the platform

`platformServiceManager(platform, { launchd, systemd, taskScheduler })` returns the launchd manager on `darwin`, the systemd manager on `linux`, the Task Scheduler manager on `win32` when `taskScheduler` is given, and `null` elsewhere. `PlatformServiceOptions` requires the launchd and systemd options. Check for `null` before you call `serviceDefinition`, which throws on an unsupported platform.

## Adapters

Every manager takes a `CommandRunner` as `run` and a `ServiceFiles` as `files`. [Adapters and testing](/service/adapters) covers the real ones in `@adecore/service/system` and a test with fakes.
