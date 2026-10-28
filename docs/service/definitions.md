# Definitions

A definition is the text of a launchd property list, a systemd unit or a Windows scheduled task, built from one `ServiceSpec`. Building it has no side effects.

```ts
import { definitionRunsProgram, launchAgentPlist, scheduledTask, systemdUnit, type ServiceSpec } from '@adecore/service/definitions';
import { serviceDefinition } from '@adecore/service/platform';
```

## ServiceSpec

Every field but `user` is required, even on platforms that ignore it.

| Field | Type | |
| --- | --- | --- |
| `label` | `string` | The launchd label. Pass the same one to the launchd manager. |
| `description` | `string` | The unit's `Description` and the task's. launchd ignores it. |
| `program` | `string` | The absolute path of the executable. |
| `args` | `string[]` | The arguments as the program receives them, without shell quoting. |
| `environment` | `Record<string, string>` | The whole environment. Nothing comes from a login shell, so pass `PATH` if needed. |
| `workingDirectory` | `string` | The folder the program starts in. |
| `logFile` | `string` | Where launchd and the scheduled task write stdout and stderr. systemd logs to the journal. |
| `user` | `string`, optional | The account a scheduled task starts for at logon, as `DOMAIN\name`. Only the task reads it, and requires it. |

The systemd unit is named by the manager's `unitName`, not by the spec.

## What the definitions hold

| Function | Returns |
| --- | --- |
| `launchAgentPlist(spec)` | A property list with `ProgramArguments`, `EnvironmentVariables`, `WorkingDirectory`, `RunAtLoad` and `KeepAlive` set to true, `ProcessType` set to `Interactive` so launchd does not throttle it, and both output streams to `logFile`. |
| `systemdUnit(spec)` | A unit with `Type=simple`, `ExecStart`, one `Environment` line per variable, `WorkingDirectory`, `Restart=always`, `RestartSec=2` and `WantedBy=default.target`. |
| `scheduledTask(spec)` | Task Scheduler XML with a `LogonTrigger` for `user`, an `InteractiveToken` principal at `LeastPrivilege`, no time limit and `IgnoreNew` for a second instance. The trigger repeats every minute, so an ended program comes back within a minute. The action runs `cmd.exe` titled with the label, sets the environment, starts the program and appends both output streams to `logFile`. Throws without `user`. |
| `serviceDefinition(platform, spec)` | The property list on `darwin`, the unit on `linux`, the task on `win32`. Throws on any other platform. |

A user unit stops when the person logs out, unless lingering is on; see [Lingering](/service/managers#lingering).

## Escaping

Pass every value unescaped. The property list escapes `&`, `<` and `>`. The unit quotes every word of `ExecStart` and every `Environment` assignment, escapes backslashes and quotes, and doubles `%` so systemd expands no specifier. It doubles `$` in `ExecStart` only, where systemd expands variables.

```ts
systemdUnit({ ...spec, description: 'Example worker 100%', program: '/opt/My Tools/worker', args: ['--label', 'a$b'], environment: { CACHE: '/home/ada/cache%/$HOME' } });
```

The unit then holds these lines:

```ini
Description=Example worker 100%%
ExecStart="/opt/My Tools/worker" "--label" "a$$b"
Environment="CACHE=/home/ada/cache%%/$HOME"
```

The task escapes `cmd.exe` syntax with a caret, quotes arguments for the C runtime and escapes XML. It throws on a line break in an argument.

No function checks that the program exists, and only the task rejects a newline. Pass values the app trusts.

## Whose service it is

`definitionRunsProgram(definition, program)` tells whether a definition on disk runs `program`. A path that only shares a prefix does not match. Read the existing definition before you install over it, and refuse when it runs another program, so the app never takes over a service of the same name.

It searches text without parsing. In a property list it also matches the path in another field, such as an argument or the working folder.
