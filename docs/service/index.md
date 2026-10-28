# @adecore/service

Runs a program as a user service: a LaunchAgent on macOS, a systemd user unit on Linux, a scheduled task at logon on Windows. The package writes the definition and drives `launchctl`, `systemctl` or `schtasks` through a command runner and a file adapter the app passes in, so tests never touch the machine.

```sh
bun add @adecore/service
```

## Entry points

| Import | Holds | Runs in |
| --- | --- | --- |
| `@adecore/service/definitions` | `ServiceSpec` and the functions that turn it into a definition | Anywhere; imports nothing |
| `@adecore/service/manager` | The three managers and the adapter types | Node or Bun |
| `@adecore/service/platform` | The manager and definition for a `process.platform` | Node or Bun |
| `@adecore/service/system` | `runCommand` and `diskFiles`, the adapters that touch the machine | Node or Bun |
| `@adecore/service` | All of the above | Node or Bun |

## Installing a service

```ts
import { definitionRunsProgram, diskFiles, platformServiceManager, runCommand, serviceDefinition, type ServiceSpec } from '@adecore/service';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

const home = homedir();
const spec: ServiceSpec = {
    label: 'com.example.worker',
    description: 'Example worker',
    program: '/opt/example/bin/worker',
    args: ['--listen', '127.0.0.1'],
    environment: { PATH: '/usr/bin:/bin' },
    workingDirectory: home,
    logFile: join(home, 'Library', 'Logs', 'Example', 'worker.log')
};

const manager = platformServiceManager(process.platform, {
    launchd: { label: spec.label, logFile: spec.logFile, uid: userInfo().uid, home, run: runCommand, files: diskFiles, sleep: (ms) => setTimeout(ms) },
    systemd: { unitName: 'example-worker.service', configHome: join(home, '.config'), user: userInfo().username, run: runCommand, files: diskFiles }
});
if (manager === null) {
    throw new Error('No user services on this platform.');
}

const existing = manager.read();
if (existing !== null && !definitionRunsProgram(existing, spec.program)) {
    throw new Error(`${manager.path} runs another program.`);
}
if (manager.install(serviceDefinition(process.platform, spec))) {
    await manager.restart();
} else {
    manager.start();
}
```

`install` returns `true` only when it replaced a different definition, so a running service must restart.

- [Definitions](/service/definitions): the spec, the definitions and escaping.
- [Managers](/service/managers): each step on launchd, systemd and Task Scheduler, lingering, the adapters and testing.

## What the app owns

The app passes every name, path, user and the environment; the package reads nothing from the running process. The app also checks, before it calls a manager, where the program lives, who may install or replace the service and whether a person agreed to lingering. Keep service control in the backend, and let a page reach it only through the app's check of the sender.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/service/LICENSE).
