# PHP language server

`@adecore/php-language-server` contains a native PHP language server and its standalone Cargo workspace. PHP 8.1 through 8.5, Composer indexing, completion, navigation, rename, inspections, formatting, refactors, PHPUnit, Pest, Laravel and Symfony come from the transferred implementation. The package remains private at `0.0.0`; the native binary reports `0.1.0`.

```ts
import {
    PHP_LANGUAGE_SERVER_METADATA,
    phpLanguageServerSourcePath,
    phpLanguageServerBinaryPath,
    type PhpLanguageServerRelease,
    type PhpLanguageServerAsset,
    type PhpLanguageServerPlatform,
    type PhpLanguageServerBinaryOptions
} from '@adecore/php-language-server';

const sourcePath = phpLanguageServerSourcePath();
const executable = phpLanguageServerBinaryPath({ sourcePath });
```

The Node entry point locates bundled source or an existing release build. It does not install, download or start anything. `PHP_LANGUAGE_SERVER_METADATA` records the native version, stubs commit and original handoff revision. `PhpLanguageServerBinaryOptions.targetDirectory` supports `CARGO_TARGET_DIR`. Executables inside an Electron archive must be unpacked by the host.

## Handbook

- [Getting started](/php-language-server/handbook/getting-started)
- [Distribution and native metadata](/php-language-server/handbook/distribution)
- [Server and document lifecycle](/php-language-server/handbook/lifecycle)
- [Configuration, Composer and stubs](/php-language-server/handbook/configuration)
- [PHP features](/php-language-server/handbook/features)
- [Frameworks and test support](/php-language-server/handbook/frameworks)
- [Maintaining and validating](/php-language-server/handbook/maintainers)

## Validation

JavaScript builds independently of native compilation. In `packages/php-language-server`, run `bun run build`, `bun run typecheck` and `bun run test`. Native validation uses:

```sh
cargo fmt --all --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
cargo build --release --locked
python3 scripts/handshake.py target/release/php-language-server
```

The handshake runs a real process over framed stdio and checks initialization, UTF-8 negotiation, document symbols and clean shutdown. No external PHP interpreter, stubs download or fixed delay is required. Corpus tests skip when their separately downloaded fixtures are absent. The package's `NATIVE.md` retains the corpus instructions, measurements and full roadmap.

## Distribution and host responsibilities

`native-source.json` lists macOS arm64/x64, Linux arm64/x64 and Windows x64 targets. The dedicated native workflow validates these builds. Manual artifact generation against an existing release tag produces platform archives, SHA-256 sidecars and `php-language-server-release.json`. The shared release workflow calls the native workflow with the exact release tag, verifies the descriptor identity and attaches these assets before npm publication. An application must pin an actual published descriptor; no release assets have been published as part of this extraction.

`PhpLanguageServerRelease` uses the binary's version, stubs commit and per-platform `PhpLanguageServerAsset` records. Each asset includes `url`, `sha256`, `format` and `executable`. Generated descriptors add the shared Adecore version and exact build source commit. Cargo's source version remains independent of the shared npm release series during this migration.

A development host supplies an explicit source folder or uses `phpLanguageServerSourcePath()` instead of detecting a sibling application checkout. An installed host passes a pinned descriptor to its existing native installer. The host still decides when the user may install, verifies checksums before extraction, enforces custom-server permissions, keeps its existing cache and manages each project's server process. Supply `storagePath` and the pinned `stubsPath` through LSP initialization options.

## Remaining work

The transfer preserves the server's current limits. Twig and Blade still need complete language models. Livewire, Inertia, DQL and query strings, Composer classmap/files support, PHPDoc aliases and a persistent reference index remain pending. Usages in installed packages and names embedded in ordinary strings are not resolved today. See the complete roadmap in the native workspace guide before relying on an unfinished feature.

The native workspace declares MIT. External phpstorm-stubs and php-src corpora are downloaded separately and retain their upstream licenses. Keep the consumer's original implementation until its complete editor and daemon cutover passes validation, including an installed binary outside a development checkout.
