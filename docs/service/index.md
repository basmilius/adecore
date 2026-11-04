# Service

`@adecore/service` runs a program as a user service: a LaunchAgent on macOS, a systemd user unit on Linux, a scheduled task at logon on Windows. The package writes the definition and drives `launchctl`, `systemctl` or `schtasks` through a command runner and a file adapter the app passes in, so tests never touch the machine.

## What it does

- Builds the property list, the unit or the task XML from one `ServiceSpec`, escaped for each format.
- Installs, starts, restarts, stops and uninstalls the service, each with the platform's own commands.
- Tells whether a definition on disk runs the app's program, so the app never takes over a service of the same name.
- Turns on lingering on Linux, so a user unit outlives the person's session, when the app asks.
- Picks the manager and the definition for a `process.platform`.

## What it leaves to the app

The app passes every name, path, user and the environment; the package reads nothing from the running process. The app also checks, before it calls a manager, where the program lives, who may install or replace the service and whether a person agreed to lingering. Keep service control in the backend, and let a page reach it only through the app's check of the sender.

## Entry points

| Import | Holds | Runs in |
| --- | --- | --- |
| `@adecore/service/definitions` | `ServiceSpec` and the functions that turn it into a definition | Anywhere; imports nothing |
| `@adecore/service/manager` | The three managers and the adapter types | Node or Bun |
| `@adecore/service/platform` | The manager and definition for a `process.platform` | Node or Bun |
| `@adecore/service/system` | `runCommand` and `diskFiles`, the adapters that touch the machine | Node or Bun |
| `@adecore/service` | All of the above | Node or Bun |

## Where to next

- [Getting started](/service/getting-started) installs a first service and replaces it on the next release.
- [Definitions](/service/definitions) covers the spec, the three definitions and their escaping.
- [Managers](/service/managers) covers each step on launchd, systemd and Task Scheduler, and lingering.
- [Adapters and testing](/service/adapters) covers the command runner, the file adapter and a test without the machine.
- [Reference](/service/reference) lists the spec, the manager and every export.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/service/LICENSE).
