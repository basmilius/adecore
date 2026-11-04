# Reference

```ts
import { definitionRunsProgram, diskFiles, platformServiceManager, runCommand, serviceDefinition, type ServiceSpec } from '@adecore/service';
```

## Tables

[Definitions](/service/definitions#servicespec) lists the fields of `ServiceSpec`. [Managers](/service/managers#servicemanager) lists the members of `ServiceManager`, and each platform's section lists its options: [`LaunchdOptions`](/service/managers#launchd), [`SystemdOptions`](/service/managers#systemd) and [`TaskSchedulerOptions`](/service/managers#task-scheduler).

### `PlatformServiceOptions`

| Option | Type | |
| --- | --- | --- |
| `launchd` | `LaunchdOptions` | Used on `darwin`. |
| `systemd` | `SystemdOptions` | Used on `linux`. |
| `taskScheduler` | `TaskSchedulerOptions`, optional | Used on `win32`. Without it there is no manager on Windows. |

### Which function runs where

| Function | `darwin` | `linux` | `win32` | Elsewhere |
| --- | --- | --- | --- | --- |
| `serviceDefinition(platform, spec)` | `launchAgentPlist` | `systemdUnit` | `scheduledTask` | Throws |
| `platformServiceManager(platform, options)` | `launchdManager` | `systemdManager` | `taskSchedulerManager`, or `null` | `null` |

## Exports

Every name each entry point exports, read from its source. Anything not listed is internal and may change in any release.

### `@adecore/service`

Every name of the four entry points below, from one import.

<ExportTable entry="@adecore/service" />

### `@adecore/service/definitions`

The spec and the functions that turn it into a definition. Imports nothing, so it runs anywhere.

<ExportTable entry="@adecore/service/definitions" />

### `@adecore/service/manager`

The three managers and the adapter types. Node or Bun.

<ExportTable entry="@adecore/service/manager" />

### `@adecore/service/platform`

The manager and the definition for a `process.platform`. Node or Bun.

<ExportTable entry="@adecore/service/platform" />

### `@adecore/service/system`

`runCommand` and `diskFiles`, the adapters that touch the machine. Node or Bun.

<ExportTable entry="@adecore/service/system" />
