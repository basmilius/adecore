# Distribution

A release of the adecore packages also builds the server for four platforms and attaches the archives to the GitHub release, with a checksum file each and one descriptor that an installer pins. The npm package carries no binary.

| `PhpLanguageServerPlatform` | Cargo target                | Archive  | Executable                |
| --------------------------- | --------------------------- | -------- | ------------------------- |
| `darwin-arm64`              | `aarch64-apple-darwin`      | `tar.gz` | `php-language-server`     |
| `linux-arm64`               | `aarch64-unknown-linux-gnu` | `tar.gz` | `php-language-server`     |
| `linux-x64`                 | `x86_64-unknown-linux-gnu`  | `tar.gz` | `php-language-server`     |
| `win32-x64`                 | `x86_64-pc-windows-msvc`    | `zip`    | `php-language-server.exe` |

macOS is Apple silicon only. There is no Intel Mac, musl Linux or Windows on Arm build; a platform without an entry is unsupported, not something to fall back from.

An archive is named `php-language-server-<tag>-<platform>.<format>` and holds the executable, the license, `THIRD-PARTY.md`, the licenses of the Rust dependencies and a `native-source.json` that records the build. Next to it, `<archive>.sha256` holds its checksum.

## The descriptor

`php-language-server-release.json` describes one release, in the shape of `PhpLanguageServerRelease`:

```json
{
    "version": "0.1.0",
    "stubsCommit": "e4f5f6c3de39f3bab3e9f3fca4b8cdb8b061e681",
    "adecoreVersion": "<version>",
    "sourceRevision": "<the commit the archives were built from>",
    "assets": {
        "darwin-arm64": {
            "url": "https://github.com/basmilius/adecore/releases/download/v<version>/php-language-server-v<version>-darwin-arm64.tar.gz",
            "sha256": "<checksum>",
            "format": "tar.gz",
            "executable": "php-language-server"
        }
    }
}
```

`version` is the server's own and must match `--version`; `adecoreVersion` is the release it came with. An installer pins a descriptor and, for the platform it runs on:

1. Takes the `PhpLanguageServerAsset` of the platform, or stops when there is none.
2. Downloads the archive and checks its SHA-256 against `sha256` before unpacking anything.
3. Unpacks it into the app's own folder, keeps the executable bit, and checks `--version` against `version`.
4. Passes the stubs of `stubsCommit` or a `storagePath` when it starts the server.

The package has no download, unpack or checksum function; those steps and the permission to take them are the app's.

## Metadata

`PHP_LANGUAGE_SERVER_METADATA` holds the server `version`, the `stubsCommit` and the `sourceRevision` the server was moved from. The same pins, with the platforms and their targets, are in `@adecore/php-language-server/native-source.json`. The package build fails when they disagree with `Cargo.toml` or the stubs pin in the source.

## How a release builds them

`.github/workflows/php-language-server.yml` checks the workspace, builds each target on a runner of its platform, runs the handshake against the binary, and, given a release tag, packs the archives and merges the descriptors. `release.yml` calls it with the tag of the release, checks that the descriptor names the same version, and uploads the descriptor with the four archives and four checksums before the npm packages publish.

For a local archive of a binary you built:

```sh
python3 scripts/native-release.py asset \
    --binary target/release/php-language-server \
    --platform darwin-arm64 --tag v0.0.0-local --output artifacts
```

The tag must be a semver tag. The script checks the binary's version and the pins, not its architecture, so pick the platform that matches. `native-release.py merge --input artifacts --output descriptor.json` needs one archive and descriptor for every platform and checks every checksum.
