# Getting started

Build a `ServiceSpec` from values your host already owns. The package does not infer the home directory, user id, shell environment, service name or executable location.

The current package is private. In an authorized local checkout, the package's build produces `dist` for Node and Bun. A bundler or runtime configured with the `source` condition can resolve the TypeScript entrypoint directly. There is no published version to install yet.

## A safe first installation

This complete example writes to a `Map` and records commands. It does not install a machine service. Replace these adapters only in an authorized backend flow.

```ts
import { definitionRunsProgram, launchAgentPlist, launchdManager, type CommandRunner, type ServiceFiles, type ServiceSpec } from '@adecore/service';

const spec: ServiceSpec = {
    label: 'com.example.worker',
    description: 'Example background worker',
    program: '/opt/example/bin/worker',
    args: ['--listen', '127.0.0.1'],
    environment: { PATH: '/usr/bin:/bin', WORKER_HOME: '/Users/ada/.worker' },
    workingDirectory: '/Users/ada',
    logFile: '/Users/ada/Library/Logs/Example/worker.log'
};
const contents = new Map<string, string>();
const commands: string[][] = [];
const files: ServiceFiles = {
    read: (path) => contents.get(path) ?? null,
    write: (path, text) => {
        contents.set(path, text);
    },
    remove: (path) => {
        contents.delete(path);
    },
    makeDirectory: () => {}
};
const run: CommandRunner = (command, args) => {
    commands.push([command, ...args]);
    return { code: args[0] === 'print' ? 113 : 0, stdout: '', stderr: '' };
};
const manager = launchdManager({
    label: spec.label,
    uid: 501,
    home: '/Users/ada',
    logFile: spec.logFile,
    files,
    run,
    sleep: async () => {}
});

const previous = manager.read();
if (previous !== null && !definitionRunsProgram(previous, spec.program)) {
    throw new Error('The existing service uses another executable.');
}
const changed = manager.install(launchAgentPlist(spec));
if (changed) {
    await manager.restart();
} else {
    manager.start();
}
```

`install()` returns `true` only when a definition already existed and its text changed. A first installation returns `false`, so this flow starts it. An unchanged installation also returns `false`.

## Selecting a platform

For Linux, use `systemdUnit(spec)` and `systemdManager({ unitName, configHome, user, run, files })`. A typical `unitName` ends in `.service`. The spec still requires `label` and `logFile`, although systemd does not use them.

`platformServiceManager(platform, { launchd, systemd })` requires both sets of explicit options. It returns `null` on an unsupported platform. Test that result before generating a definition: `serviceDefinition(platform, spec)` throws for unsupported platforms.

Production wiring uses `diskFiles`, `runCommand` and an asynchronous timer for `sleep`. Those adapters change the machine. Put the authorization and ownership checks before calling the manager, as described in [Testing and host migration](/service/testing-migration).
