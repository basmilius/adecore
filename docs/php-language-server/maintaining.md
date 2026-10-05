# Maintaining

The server is a Cargo workspace of five crates in `packages/php-language-server`, MIT, with `unsafe` code forbidden.

| Crate                 | Folder           | What it holds                                                                       |
| --------------------- | ---------------- | ----------------------------------------------------------------------------------- |
| `php-syntax`          | `crates/syntax`  | The lexer, a lossless parser with error recovery, and the table of language levels  |
| `php-format`          | `crates/format`  | The formatter and EditorConfig, without LSP types                                   |
| `php-index`           | `crates/index`   | Declarations, PHPDoc, Composer, the stubs, the cache and the framework catalogs     |
| `php-analysis`        | `crates/analysis`| Types, diagnostics, inspections, navigation, completion, rename and refactors       |
| `php-language-server` | `crates/server`  | The stdio server: documents, configuration, projects, progress and LSP conversions  |

LSP types and the process belong in the server crate. The parser stops nesting at 200 levels, so deeply nested input becomes an error node instead of a stack overflow.

## Checks

From `packages/php-language-server`:

```sh
bun run build && bun run typecheck && bun run test
cargo fmt --all --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
python3 scripts/test-native-release.py
cargo build --release --locked
python3 scripts/handshake.py target/release/php-language-server
```

The Bun build compiles the Node entry point and checks the version pins; it needs no Rust. The Cargo tests run on temporary fixture projects with fake packages and stubs, in memory, without PHP or a network. The handshake starts the real binary and checks its version, the handshake, UTF-8 positions, document symbols and a clean shutdown. `test-native-release.py` checks the release script on made-up archives. The `native:*` scripts in `package.json` run the same Cargo steps.

## Corpus

The corpus of real PHP is not in Git or npm. Fetch it only when you mean to download:

```sh
./scripts/fetch-corpus.sh
cargo test --locked --test corpus
cargo run --release -p php-syntax --example corpus -- phpt --oracle --verbose
```

It pins phpstorm-stubs and the test folders of php-src. The `--oracle` mode compares the parser with `php -l` of the PHP on the path; note that interpreter's version with the result. Without the corpus its tests report a skip. `NATIVE.md` lists the benchmarks, the memory and type coverage tools and earlier measurements, which hold for their own machines.
