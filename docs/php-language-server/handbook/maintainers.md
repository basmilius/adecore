# Maintaining and validating the server

The native implementation is a standalone Cargo workspace with its retained lockfile. Its declared license is MIT. `native-source.json` records the native/stub versions and original source handoff; release descriptors separately identify the exact Adecore build commit.

## Five crates

| Crate                 | Responsibility                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `php-syntax`          | Lossless rowan tree, lexer/parser, recovery and language-level table.                                               |
| `php-format`          | Whitespace edits, wrapping and EditorConfig; no LSP dependency.                                                     |
| `php-index`           | Declarations/PHPDoc, Composer and stubs, cache, parallel indexing, class hierarchy and framework catalogs.          |
| `php-analysis`        | Type inference and feature queries, diagnostics, navigation, refactors, tests/framework reading and offset mapping. |
| `php-language-server` | Stdio front end, documents, configuration, project lifecycle, progress and LSP conversions.                         |

Keep LSP types and process transport in the server crate. A parser change belongs with recovery/round-trip cases; a formatting change needs token preservation and second-pass stability; an analysis change needs a fixture proving both the result and its refusal boundary. Overlay files are data, not code to execute.

The parser limits nesting to 200 and produces an error-recovering tree rather than discarding an unfinished document. That also limits synthetic deeply nested PHP stack-limit corpus cases. Native source forbids unsafe Rust and retains the workspace lint settings.

## Fixture and handshake validation

Run from `packages/php-language-server`:

```sh
cargo fmt --all --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
python3 scripts/test-native-release.py
cargo build --release --locked
python3 scripts/handshake.py target/release/php-language-server
```

Default tests use temporary fixture projects, fake Composer packages/stubs and in-memory LSP connections. They do not need PHP or an external service. Cargo may need dependencies already cached or registry access to build. Real-corpus cases report a skip when separately fetched corpus data is absent; a passing skipped corpus case is not a fresh corpus measurement.

The handshake checks a real executable with bounded response waits, not a mocked connection. It asserts metadata version, initialization, UTF-8, nested document symbols and shutdown/exit with no persistent storage or network request. Run it on each distributed binary after extraction, not only a development build.

`test-native-release.py` validates descriptor merging, complete platform sets, stale pins/source mismatches and checksum refusal using synthetic archives. It is not proof that production release URLs exist. [Distribution](/php-language-server/handbook/distribution) describes archive/checksum and release-attachment responsibilities.

## Corpus workflow

The corpus is intentionally separate from npm and Git. Fetch it only when network/download work is authorized:

```sh
./scripts/fetch-corpus.sh
cargo test --locked --test corpus
cargo run --release -p php-syntax --example corpus -- stubs
cargo run --release -p php-syntax --example corpus -- phpt --oracle --verbose
```

The script pins phpstorm-stubs and php-src's `php-8.5.11` test directories. The oracle mode invokes the PHP interpreter on PATH to compare with `php -l`; record that interpreter's version. There is no interpreter in the default handshake/test path. Retain downloaded upstream licenses and do not embed private project source in reports or fixtures.

For an authorized project, the parser example also accepts `dir=<project> --oracle`. Formatter corpus checks use `cargo run --release -p php-format --example check -- <folder>` with optional `--tabs --wrap --align --width <n>`. They check token equality and formatting twice. Historical measurements in `NATIVE.md` describe their own machines/corpora, not guaranteed latency for another host.

## Measurements

| Tool                                                                            | What to compare                                                                                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `cargo bench -p php-syntax`                                                     | Parser/lexer throughput with Criterion.                                                                                  |
| `cargo run --release -p php-index --example bench -- <project> <stubs> [cache]` | Indexing and resident size, cold versus warm cache.                                                                      |
| `cargo run --release -p php-analysis --example typecov -- <project> <stubs>`    | Resolved type coverage with Composer/framework detection.                                                                |
| Analysis `survey`, `stress`, `probe`, `refactor_smoke` examples                 | Findings, requests across positions and refactor application/refusals. Read each tool's argument parser before a run.    |
| `scripts/measure-memory.py`                                                     | Real-server resident memory and representative requests with explicit binary/project/stubs/storage/file/class arguments. |
| `scripts/survey-usages.py`                                                      | Compare usages against another explicitly authorized server.                                                             |

Keep source revision, release/debug profile, hardware, PHP/stub versions, corpus size, cache state and command in each report. Benchmark commands can read a large project or invoke another server; they are maintenance workflows, not normal import-time behavior.

## Troubleshooting

| Symptom                            | Likely boundary to inspect                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Locator returns `null`             | Build location, `CARGO_TARGET_DIR`, target subdirectory, platform suffix and Electron unpacking.                   |
| Binary fails before initialize     | Architecture/runtime compatibility, permissions, `--version` and captured stderr.                                  |
| Requests hang                      | Byte framing, initialize/initialized order, server-request response handling and process liveness.                 |
| Standard-library names are missing | Explicit stubs path, commit/complete marker, extension requirements or failed background fetch.                    |
| Project symbols are stale          | Workspace URI, watched-file registration/events, open text and changed Composer metadata.                          |
| Formatting returns `null`          | Open document, parse errors, markup around PHP or no applicable edit.                                              |
| Rename/refactor refuses            | Returned reason, unresolved receiver, external declaration, conflict or unsupported resource-operation capability. |
| Framework completion is missing    | Installed Composer package detection, literal/static declarations and documented framework limits.                 |

Preserve the consumer's original implementation until its full editor, process and installed-artifact migration is validated. The package transfer alone does not verify permissions, cache compatibility, process shutdown or distribution.
