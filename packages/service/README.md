# @adecore/service

Definitions and injectable managers for macOS launchd GUI jobs and Linux systemd user services. The host supplies identity, paths, environment, commands and files. It keeps installation authorization and executable policy.

The package is private at `0.0.0` pending first publication. Use its local `source` exports, or run the package build for compiled JavaScript and declarations. It retains the [FSL-1.1-MIT license](LICENSE).

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

The full documentation covers [getting started](https://adecore.dev/service/getting-started), [definitions and identity](https://adecore.dev/service/definitions), [lifecycle](https://adecore.dev/service/lifecycle), [API reference](https://adecore.dev/service/reference) and [testing and host migration](https://adecore.dev/service/testing-migration). The first guide uses safe fakes rather than real service commands.
