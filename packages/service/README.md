# @adecore/service

Definitions and injectable managers for macOS launchd GUI jobs and Linux systemd user services. The host supplies identity, paths, environment, commands and files. It keeps installation authorization and executable policy.

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

`/definitions` has no Node or Bun runtime imports. The root, `/manager`, `/platform` and `/system` are backend entrypoints. Importing them does not install or start a service.

`install()` returns whether an existing definition changed, so a first install returns `false`. Await `restart()` for a changed definition, otherwise call `start()`. Uninstall does not stop a running job. Managers supply no authorization, lock, cancellation or automatic lingering.

The full documentation covers the [overview](https://adecore.dev/service/), [definitions](https://adecore.dev/service/definitions) and [managers](https://adecore.dev/service/managers), with a test that uses fakes instead of real service commands.
