# Definitions

A definition is the text of a launchd property list or a systemd unit, built from one `ServiceSpec`. Building one writes nothing and starts nothing.

```ts
import { definitionRunsProgram, launchAgentPlist, systemdUnit, type ServiceSpec } from '@adecore/service/definitions';
import { serviceDefinition } from '@adecore/service/platform';
```

## ServiceSpec

Every field is required, also those only one platform reads.

| Field | Type | |
| --- | --- | --- |
| `label` | `string` | The launchd label. Pass the same one to the launchd manager. |
| `description` | `string` | The unit's `Description`. launchd ignores it. |
| `program` | `string` | The absolute path of the executable. |
| `args` | `string[]` | The arguments as the program receives them, without shell quoting. |
| `environment` | `Record<string, string>` | The whole environment. Nothing is taken from a login shell, so pass `PATH` if the program needs one. |
| `workingDirectory` | `string` | The folder the program starts in. |
| `logFile` | `string` | Where launchd writes stdout and stderr. systemd logs to the journal. |

The systemd unit is named by the manager's `unitName`, not by the spec.

## What the definitions hold

| Function | Returns |
| --- | --- |
| `launchAgentPlist(spec)` | A property list with `ProgramArguments`, `EnvironmentVariables`, `WorkingDirectory`, `RunAtLoad` and `KeepAlive` set to true, `ProcessType` set to `Interactive` so launchd does not throttle it, and both output streams to `logFile`. |
| `systemdUnit(spec)` | A unit with `Type=simple`, `ExecStart`, one `Environment` line per variable, `WorkingDirectory`, `Restart=always`, `RestartSec=2` and `WantedBy=default.target`. |
| `serviceDefinition(platform, spec)` | The property list on `darwin`, the unit on `linux`. Throws on any other platform. |

A user unit stops when the person logs out, unless lingering is on; see [Lingering](/service/managers#lingering).

## Escaping

Pass every value unescaped. The property list escapes `&`, `<` and `>`. The unit quotes every word of `ExecStart` and every `Environment` assignment, escapes backslashes and quotes, and doubles `%` everywhere so systemd expands no specifier. `$` is doubled in `ExecStart` only, since systemd expands variables there and not in `Environment`. `WorkingDirectory` is written without quotes, because systemd reads the rest of that line as the path.

```ts
systemdUnit({ ...spec, description: 'Example worker 100%', program: '/opt/My Tools/worker', args: ['--label', 'a$b'], environment: { CACHE: '/home/ada/cache%/$HOME' } });
```

The unit then holds these lines:

```ini
Description=Example worker 100%%
ExecStart="/opt/My Tools/worker" "--label" "a$$b"
Environment="CACHE=/home/ada/cache%%/$HOME"
```

Neither function checks that the program exists or rejects a newline in a value. Pass values the app trusts.

## Whose service it is

`definitionRunsProgram(definition, program)` tells whether a definition on disk runs `program`: as a `<string>` in the property list, or as the first word of `ExecStart` in the unit. A path that only starts the same does not match. Read the existing definition before you install over it, and refuse when it runs another program, so an app never takes over a service of the same name that is not its own.

It searches text and parses neither format. In a property list it also matches the path in another field, such as an argument or the working folder.
