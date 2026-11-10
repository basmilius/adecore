# Getting started

## Install

The package has no peers and no styles:

```sh
bun add @adecore/service
```

Run it in the app's backend, in Node or Bun. `@adecore/service/definitions` imports nothing, so a page may import it to show a definition, but only the backend writes one.

## Describe the service

A `ServiceSpec` names the program, its arguments, its environment and where it logs. Nothing comes from a login shell, so pass `PATH` if the program needs it:

```ts
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import type { ServiceSpec } from '@adecore/service';

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
```

[Definitions](/service/definitions#servicespec) lists every field, including the two only Windows reads.

## Pick the manager

`platformServiceManager` returns the manager of the platform, or `null` where the package has none. `runCommand` and `diskFiles` are the adapters that touch the machine:

```ts
import { setTimeout } from 'node:timers/promises';
import { diskFiles, platformServiceManager, runCommand } from '@adecore/service';

const manager = platformServiceManager(process.platform, {
    launchd: { service: spec, uid: userInfo().uid, home, run: runCommand, files: diskFiles, sleep: (ms) => setTimeout(ms) },
    systemd: { unitName: 'example-worker.service', configHome: join(home, '.config'), user: userInfo().username, run: runCommand, files: diskFiles }
});

if (manager === null) {
    throw new Error('No user services on this platform.');
}
```

Without `taskScheduler` options there is no manager on Windows. [Managers](/service/managers#task-scheduler) shows what it needs.

## Install and start

Read what is on disk first. When a definition of the same name runs another program, it belongs to someone else, so refuse:

```ts
import { definitionRunsProgram, serviceDefinition } from '@adecore/service';

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

`install` returns `true` only when it replaced a different definition. A running service keeps the definition it started with, so it must restart. A first install, or the same definition again, returns `false`, and `start` starts the service or leaves a running one alone.

Run this on every start of the app. When a release changes the binary but not the definition, call `restart()` yourself, so the new binary takes over.

## Remove it

`stop()` ends the service and `uninstall()` removes its definition. Stop first, because an uninstalled service keeps running, and on Windows the manager cannot stop a deleted task.

```ts
manager.stop();
manager.uninstall();
```

## Checklist

- Every path in the spec is absolute, and `environment` holds everything the program needs.
- The managers get the spec, or the same `label` and `logFile`, as `service`.
- On Windows, the spec has `user` and `scriptDirectory`.
- The app refuses a definition that runs another program before it installs over it.
- Only one change runs at a time, and `restart()` is awaited.
- On Linux, lingering is turned on only after the person agreed ([Lingering](/service/managers#lingering)).
