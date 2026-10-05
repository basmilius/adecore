# Definitions and identity

`launchAgentPlist(spec)` and `systemdUnit(spec)` are pure functions returning UTF-8 definition text. A definition neither copies an executable nor starts it.

## Required spec

Every `ServiceSpec` field is required, including the fields that only one platform uses.

| Field                                 | Meaning                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| `label: string`                       | LaunchAgent identity. Use the same label in `LaunchdOptions`.         |
| `description: string`                 | systemd unit description.                                             |
| `program: string`                     | Executable path, separate from arguments. Use a stable absolute path. |
| `args: string[]`                      | Arguments in their original form, without shell quotes.               |
| `environment: Record<string, string>` | Explicit environment entries. No login-shell environment is captured. |
| `workingDirectory: string`            | Directory the process starts in.                                      |
| `logFile: string`                     | launchd stdout and stderr destination. systemd uses the journal.      |

The systemd identity is `SystemdOptions.unitName`, not the spec's label. The generated unit does not contain the unit filename. Keep identity and paths stable across a package migration so an existing service remains the same job.

## Generated behavior

The LaunchAgent uses `ProgramArguments` with the executable first, `RunAtLoad=true`, `KeepAlive=true` and `ProcessType=Interactive`. Both output streams go to `logFile`. The manager creates that log directory during install because launchd does not create it.

The systemd unit has `Type=simple`, `Restart=always`, `RestartSec=2` and `WantedBy=default.target`. It runs in the user's service manager. Lingering is a separate host decision, not a generated unit setting.

Neither generator validates executable existence, argument meaning, environment names or host permissions. Use trusted single-line values for unit descriptions, environment entries and paths; the implementation escapes expansion characters but does not reject embedded newlines or service identities containing path separators.

## Escaping

Pass unescaped strings. launchd XML text escapes `&`, `<` and `>`. systemd command words quote spaces, escape backslashes and quotes, double `%` specifiers and double `$` in command arguments. Environment values double `%`, but keep `$` literal because systemd does not expand environment assignments as shell commands. `WorkingDirectory` consumes the rest of the line without quotes and doubles `%`.

```ts
import { systemdUnit, type ServiceSpec } from '@adecore/service/definitions';

const spec: ServiceSpec = {
    label: 'com.example.worker',
    description: 'Example worker 100%',
    program: '/opt/My Tools/worker',
    args: ['--label', 'a$b'],
    environment: { WORKER_HOME: '/home/ada/cache%/$HOME' },
    workingDirectory: '/home/ada',
    logFile: '/home/ada/worker.log'
};
const definition = systemdUnit(spec);
```

This produces a quoted executable, `"a$$b"` in `ExecStart`, and `%%` for each literal percent. Do not wrap the command in a shell to compensate for escaping.

## Checking executable identity

`definitionRunsProgram(definition, program)` recognizes the generated XML string or the quoted first word of an `ExecStart` line. It distinguishes an executable from another path with the same prefix. It is a textual compatibility check for these generated formats, not a general plist parser, unit parser or proof of file ownership. In particular, the XML check can match the same string in another field.

Read an existing definition before replacing it. Refuse a conflicting executable, then apply the host's file ownership and installation policy. Do not silently adopt a foreign service just because its label matches. The manager itself accepts any definition string.
