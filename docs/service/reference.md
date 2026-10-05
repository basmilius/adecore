# Service API reference

## Entrypoints

| Import                         | Exports and boundary                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `@adecore/service`             | All public functions and types; backend because it also exports system adapters.                |
| `@adecore/service/definitions` | `ServiceSpec`, `launchAgentPlist`, `systemdUnit`, `definitionRunsProgram`; runtime independent. |
| `@adecore/service/manager`     | `launchdManager`, `systemdManager`, manager and adapter types; imports `node:path`.             |
| `@adecore/service/platform`    | `serviceDefinition`, `platformServiceManager`, `PlatformServiceOptions`; backend.               |
| `@adecore/service/system`      | `diskFiles`, `runCommand`; imports Node filesystem and child-process APIs.                      |

## Functions

```text
launchAgentPlist(spec: ServiceSpec): string
systemdUnit(spec: ServiceSpec): string
definitionRunsProgram(definition: string, program: string): boolean
serviceDefinition(platform: NodeJS.Platform, spec: ServiceSpec): string
launchdManager(options: LaunchdOptions): ServiceManager
systemdManager(options: SystemdOptions): ServiceManager
platformServiceManager(platform: NodeJS.Platform, options: PlatformServiceOptions): ServiceManager | null
runCommand(command: string, args: string[]): CommandResult
```

These are signatures, not an executable code block. See [Definitions](/service/definitions) for `ServiceSpec` and [Lifecycle](/service/lifecycle) for operation semantics.

## Manager options

All options are required. `LaunchdOptions` needs `label`, numeric `uid`, `home`, `logFile`, `run`, `files` and `sleep(ms): Promise<void>`. `SystemdOptions` needs `unitName`, `configHome`, `user`, `run` and `files`. `PlatformServiceOptions` holds both as `{ launchd, systemd }`; it does not derive missing values from the current process.

`ServiceManager.kind` is `'launchd' | 'systemd'`. `path` is the definition path. Inspection and mutation methods are synchronous except `restart(): Promise<void>`. `linger` is optional and only exists on the systemd manager.

## Adapter contracts

```ts
import type { CommandRunner, ServiceFiles } from '@adecore/service/manager';

const run: CommandRunner = (_command, _args) => ({
    code: 0,
    stdout: '',
    stderr: ''
});
const data = new Map<string, string>();
const files: ServiceFiles = {
    read: (path) => data.get(path) ?? null,
    write: (path, text) => {
        data.set(path, text);
    },
    remove: (path) => {
        data.delete(path);
    },
    makeDirectory: () => {}
};
```

`CommandResult` has numeric `code` and string `stdout`/`stderr`. Runners must complete synchronously and bound their own execution. `runCommand` uses `spawnSync` without a shell, ignored stdin and a 15-second timeout for each command. A missing exit status becomes `1`; timeout/spawn errors become stderr text.

`ServiceFiles.read(path)` returns text or `null`; `write(path, text)` and `remove(path)` return `void`; `makeDirectory(path)` recursively creates parents. `diskFiles.write` creates the parent directory. `diskFiles.remove` uses force removal, without recursive directory removal. Its `read` catches every read error and returns `null`, including permission errors. Hosts that need to distinguish unreadable from absent should supply a stricter adapter.

## Errors

Checked command failures throw `Error` with `<operation> failed (<code>): <stderr or stdout>`, preferring stderr and falling back to `no output`. The package has no typed error class. File and injected runner exceptions propagate directly. See [Lifecycle](/service/lifecycle) for commands whose nonzero result is intentionally ignored.
