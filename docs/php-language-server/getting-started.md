# Getting started

## Install

```sh
bun add @adecore/php-language-server
```

The package holds the server's source, not a binary. Build it, or install a [release archive](/php-language-server/distribution).

## Build

The workspace needs Rust 1.85 or newer. From `node_modules/@adecore/php-language-server`, or `packages/php-language-server` in a checkout:

```sh
cargo build --release --locked
```

The first build fetches the crates from the registry. PHP itself is not needed, to build or to run.

## Find the binary

```ts
import { PHP_LANGUAGE_SERVER_METADATA, phpLanguageServerBinaryPath, phpLanguageServerSourcePath } from '@adecore/php-language-server';

const executable = phpLanguageServerBinaryPath();

if (executable === null) {
    throw new Error('Build the PHP language server first.');
}
```

`phpLanguageServerSourcePath()` is the folder of the Cargo workspace inside the package. `phpLanguageServerBinaryPath(options?)` returns `<target>/release/php-language-server`, with `.exe` on Windows, when that file exists, and `null` otherwise. It checks no permission, architecture or version.

| `PhpLanguageServerBinaryOptions` | Default                            | Meaning                                                                         |
| -------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| `sourcePath`                     | `phpLanguageServerSourcePath()`    | The Cargo workspace                                                             |
| `targetDirectory`                | `<sourcePath>/target`              | Cargo's target folder; set it with `CARGO_TARGET_DIR`, or to `target/<triple>` for a cross build |
| `platform`                       | `process.platform`                 | `win32` adds `.exe`                                                             |

Inside an Electron archive the path points into `app.asar.unpacked`, since a binary cannot run from `app.asar`. Unpack it when packaging.

## Start it

```sh
php-language-server --stdio
```

Without arguments it starts the same way. `--version` (or `-V`) prints `php-language-server 0.1.0` and `--help` the usage; an unknown argument exits with code 2. Stdout carries only the protocol, so read stderr apart.

## Connect

Spawn the binary in the app's backend and connect an [`LspSession`](/lsp/sessions) over its stdio. The server picks UTF-8 positions when a client offers them and UTF-16 otherwise; `@adecore/lsp` offers only UTF-16, so the two agree.

```ts
import { LspSession, createStreamTransport, pathToFileUri } from '@adecore/lsp';

const child = spawn(executable, ['--stdio'], { cwd: projectFolder });
const session = new LspSession(createStreamTransport(streamOf(child)), {
    rootUri: pathToFileUri(projectFolder),
    initializationOptions: { storagePath: cacheFolder, phpVersion: '8.4' }
});

await session.initialize();
```

`streamOf` is the `ByteStream` adapter on [Sessions and transports](/lsp/sessions#transports). Pass a `storagePath`, or the server keeps no cache and has no standard library; see [Configuration](/php-language-server/configuration).

Run one server per project and stop it with `session.shutdown()` before the process. Which executable may run, where its cache lives and when it is installed are the app's to decide.
