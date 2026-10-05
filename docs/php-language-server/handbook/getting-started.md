# Getting started

`@adecore/php-language-server` contains a standalone native stdio server, its five-crate Cargo workspace, and a small Node entrypoint that locates the source and an existing local release build. Importing it does not compile, download, install or start anything.

The npm package is private at `0.0.0`. The Cargo workspace and binary report `0.1.0`. These are separate release series during the transfer; do not use the npm version to validate `--version`.

## Find source and a local build

```ts
import { PHP_LANGUAGE_SERVER_METADATA, phpLanguageServerBinaryPath, phpLanguageServerSourcePath } from '@adecore/php-language-server';

const sourcePath = phpLanguageServerSourcePath();
const executable = phpLanguageServerBinaryPath({ sourcePath });
if (executable === null) {
    throw new Error('Build or install an authorized PHP language server first.');
}
const expectedVersion = PHP_LANGUAGE_SERVER_METADATA.version;
```

`phpLanguageServerSourcePath()` works from both the TypeScript `source` condition and compiled `dist` entrypoint because both live one directory below the bundled workspace. It replaces assumptions about a sibling application checkout. Default compiled use requires the JavaScript package build; local source use needs a runtime/bundler configured with the `source` condition.

`phpLanguageServerBinaryPath()` checks `<sourcePath>/target/release/php-language-server`, or `.exe` when `platform` is `win32`. It returns `null` when the file does not exist. It does not verify executable permission, architecture, checksum or version. With `CARGO_TARGET_DIR`, supply `targetDirectory`. For a target-specific Cargo build, supply the directory containing that target's `release` folder, such as `target/aarch64-apple-darwin`.

Electron hosts must unpack native executables. The locator rewrites an `.asar/` path segment to `.asar.unpacked/` before checking existence; the packager remains responsible for placing the file there.

## Standalone build

Run these from `packages/php-language-server` in the local checkout:

```sh
bun run build
bun run typecheck
bun run test
cargo build --release --locked
python3 scripts/handshake.py target/release/php-language-server
```

The Bun build only compiles the Node entrypoint and verifies metadata pins. Cargo needs a toolchain compatible with the retained lockfile and dependencies; the workspace declares edition 2024 and `rust-version = "1.85"`, while the dedicated CI pins its own newer toolchain. A first build may need Cargo registry access. The server does not need a PHP interpreter to parse or answer the handshake.

On Windows, pass `target/release/php-language-server.exe` to the handshake. A successful handshake verifies binary version, initialization, UTF-8 negotiation, a document-symbol request, shutdown and exit. It uses a temporary document, no cache/stub download and no fixed sleep.

## Launch over stdio

```sh
target/release/php-language-server --version
target/release/php-language-server --stdio
```

Omitting `--stdio` also starts LSP. `--help` prints usage; an unknown first argument exits with code `2`. A bare interactive terminal does not provide LSP framing, so use the handshake or your editor's language-client transport for a useful session.

Stdout is exclusively the framed protocol stream during a session. Read stderr separately and preserve it for failures. [Server lifecycle](/php-language-server/handbook/lifecycle) explains initialization and shutdown. [Distribution](/php-language-server/handbook/distribution) describes installed assets; no binary or external stubs are bundled in the npm package.
