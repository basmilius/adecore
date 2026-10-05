# @adecore/php-language-server

A language server for PHP 8.1 through 8.5, written in Rust, that speaks LSP over stdio. It indexes a project with its Composer packages and the standard library, and answers completion, hover, navigation, usages, rename, inspections with fixes, refactors, formatting, semantic tokens, inlay hints and the tests a file can run, with support for PHPUnit, Pest, Laravel and Symfony. It reads code and never runs it.

The npm package holds the Cargo workspace and a small Node entry point that finds the source and a built binary. It downloads, builds, installs and starts nothing.

```ts
import { phpLanguageServerBinaryPath } from '@adecore/php-language-server';

const executable = phpLanguageServerBinaryPath(); // a release build of the bundled workspace, or null
```

## What is in it

- [Getting started](/php-language-server/getting-started): build the server, find it, start it and connect with [`@adecore/lsp`](/lsp/).
- [Configuration](/php-language-server/configuration): the settings, the language level, Composer, the standard library stubs, the cache and the formatter.
- [Features](/php-language-server/features): what it answers, the frameworks it knows, and runnable tests.
- [Distribution](/php-language-server/distribution): the release archives per platform and the descriptor an installer pins.
- [Maintaining](/php-language-server/maintaining): the crates, the checks and the corpus.

## Versions

The npm package follows the version of every `@adecore` package. The server has a version of its own, `0.1.0`, which `php-language-server --version` prints and `PHP_LANGUAGE_SERVER_METADATA.version` holds. Check the binary against the second.

## Limits

- Twig has no language model, and Blade only a minimal one: no `@foreach` scope, props, slots or component attributes.
- Livewire, Inertia, DQL and the Doctrine query builder, Eloquent query strings and validation rule strings are not analyzed.
- Usages are found in the project, not in installed packages, and not in ordinary strings and comments. There is no reference index kept on disk.
- Composer autoloading is read from PSR-4 and PSR-0; an authoritative classmap and `files` are not looked up by name. `@psalm-type` aliases are not read.
- Dynamic code, such as variable variables and members made at run time, gives `mixed`.

`NATIVE.md` in the package describes the implementation, measurements and the full list of what is left. The server is MIT. The phpstorm-stubs it downloads are Apache 2.0 and keep their license; see `THIRD-PARTY.md`.
