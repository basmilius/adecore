# @adecore/service

Definitions and managers for macOS launchd GUI jobs and Linux systemd user services, with everything they touch injected. The host supplies the identity, paths, environment, commands and files. Deciding who may install a service and which executable it runs stays with the host.

```sh
bun add @adecore/service
```

Licensed under FSL-1.1-MIT, see [LICENSE](LICENSE).

```ts
import { systemdUnit, type ServiceSpec } from '@adecore/service/definitions';

const spec: ServiceSpec = {
    label: 'com.example.worker',
    description: 'Example background worker',
    program: '/opt/example/bin/worker',
    args: ['--listen', '127.0.0.1'],
    environment: { PATH: '/usr/bin:/bin' },
    workingDirectory: '/home/ada',
    logFile: '/home/ada/worker.log'
};
const definition = systemdUnit(spec);
```

`/definitions` imports nothing from Node or Bun. The root, `/manager`, `/platform` and `/system` are for a backend, and importing them installs or starts nothing.

`install()` returns whether an existing definition changed, so a first install returns `false`. Await `restart()` after a change, and call `start()` otherwise. Uninstalling does not stop a running job. The managers bring no authorization, lock, cancellation or automatic lingering.

The documentation has an [overview](https://adecore.dev/service/), [definitions](https://adecore.dev/service/definitions) and [managers](https://adecore.dev/service/managers), including a test that runs on fakes instead of the real service commands.
