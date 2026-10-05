# @adecore/service

Runs a program as a user service: a LaunchAgent in the GUI session on macOS, a systemd user unit on Linux. The package writes the definition and drives `launchctl` or `systemctl` through a command runner and a file adapter the app hands it, so a test runs every step without touching the machine. Windows has no manager.

```sh
bun add @adecore/service
```

## Entry points

| Import | Holds | Runs in |
| --- | --- | --- |
| `@adecore/service/definitions` | `ServiceSpec` and the functions that turn it into a definition | Anywhere; imports nothing |
| `@adecore/service/manager` | The two managers and the adapter types | Node or Bun |
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

`install` returns `true` only when it replaced a different definition, which is when a running service has to restart to pick it up.

- [Definitions](/service/definitions) covers the spec, what the definitions contain and how values are escaped.
- [Managers](/service/managers) covers every step on launchd and systemd, lingering, the adapters and testing.

## What the app owns

The package derives nothing from the running process: the label, the unit name, the home folder, the user id and the environment all come from the app. It decides nothing either. Where the program is copied to, who may install or replace the service and whether a person agreed to lingering are the app's checks, made before it calls a manager. Keep service control in the backend; a page that may ask for it goes through the app's own check of the sender.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/service/LICENSE).
