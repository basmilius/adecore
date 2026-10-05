# Distribution and native metadata

The package ships native source, not preinstalled binaries or external stubs. The host decides when installation is authorized, which cache to use and whether a custom executable may run. Keep that policy in the host rather than in a package import.

## Current metadata

`PHP_LANGUAGE_SERVER_METADATA` exports native `version`, `stubsCommit` and the original `sourceRevision`. The same pins are recorded in the exported `@adecore/php-language-server/native-source.json`. At this transfer the native version is `0.1.0`, the stubs commit is `e4f5f6c3de39f3bab3e9f3fca4b8cdb8b061e681`, and the source handoff is `9729144f0df3f25628f20cc283dee54f8d9e8162`.

| `PhpLanguageServerPlatform` | Cargo target                | Archive  |
| --------------------------- | --------------------------- | -------- |
| `darwin-arm64`              | `aarch64-apple-darwin`      | `tar.gz` |
| `darwin-x64`                | `x86_64-apple-darwin`       | `tar.gz` |
| `linux-arm64`               | `aarch64-unknown-linux-gnu` | `tar.gz` |
| `linux-x64`                 | `x86_64-unknown-linux-gnu`  | `tar.gz` |
| `win32-x64`                 | `x86_64-pc-windows-msvc`    | `zip`    |

These are the implemented release targets, not a claim that every native archive is already published. Linux targets are GNU, not musl; there is no Windows arm64 asset. Executables are `php-language-server`, or `php-language-server.exe` on Windows.

## Installer descriptor

`PhpLanguageServerRelease` has `version`, `stubsCommit` and `assets: Partial<Record<PhpLanguageServerPlatform, PhpLanguageServerAsset>>`. An asset has `url`, `sha256`, `format: 'tar.gz' | 'zip'` and the relative `executable` path. The type permits a missing platform; handle that as unsupported rather than selecting another architecture silently.

This is a pure host-side descriptor lookup. It does not download or run an asset:

```ts
import type { PhpLanguageServerAsset, PhpLanguageServerPlatform, PhpLanguageServerRelease } from '@adecore/php-language-server';

export function assetFor(release: PhpLanguageServerRelease, platform: PhpLanguageServerPlatform): PhpLanguageServerAsset {
    const asset = release.assets[platform];
    if (asset === undefined) {
        throw new Error(`No pinned PHP server asset for ${platform}.`);
    }
    return asset;
}
```

Generated descriptors additionally record `adecoreVersion` and the exact build `sourceRevision`. Archive metadata preserves the original handoff and records `adecoreSourceRevision`. Keep the distinction between original source provenance and the commit that produced an asset.

The installer should pin a real descriptor after assets exist, verify SHA-256 before extraction, validate archive paths, preserve executable permissions, check `--version`, and retain the matching stubs pin. These operations are consumer policy; this package exports no download, extraction or checksum-verification API. Do not fabricate a registry version, release URL or checksum to fill an empty installer catalog.

## Artifact generation

The dedicated `php-language-server.yml` workflow validates Cargo and builds each target, including its real stdio handshake. A manual or reusable call with an existing `release_tag` creates archives, checksum sidecars and `php-language-server-release.json` as workflow artifacts. It has read-only release permissions and does not attach assets to a GitHub release or publish npm packages. The shared `release.yml` workflow calls it with the exact release tag, verifies the shared version in the descriptor and attaches the archives, checksum sidecars and descriptor before npm publication. This prepares future releases; no native release assets have been published during extraction.

For authorized local packaging, the script accepts:

```sh
python3 scripts/native-release.py asset \
    --binary target/release/php-language-server \
    --platform darwin-arm64 --tag v0.0.0-local --output artifacts
```

This command creates local files, not a published release. The tag must be semver. Select the platform matching the binary yourself; the script checks version and pins but does not prove its architecture. It generates a descriptor URL naming the eventual release destination, which is not evidence that the URL is live.

`native-release.py merge --input <artifacts> --output <descriptor.json>` requires exactly one descriptor and archive per supported platform, matching source/version/stubs/shared-version pins and checksums. Runtime Rust dependencies' upstream license/notice files, a dependency manifest and `Cargo.lock` go into each archive. Cargo metadata can fetch missing registry manifests while gathering licenses; external corpora and stubs remain excluded.

## Version and licensing checks

The JavaScript build rejects disagreement among Cargo version, native metadata and stub pin. A future native version change must update Cargo manifests, internal crate requirements, lockfile and metadata together. The migration preserves the existing native version rather than assigning the npm version to it.

The native workspace declares MIT. [Third-party notes](https://github.com/basmilius/adecore/blob/main/packages/php-language-server/THIRD-PARTY.md) retain Rust dependency provenance, Apache-2.0 phpstorm-stubs and separately fetched php-src corpus terms. Keep those upstream materials and licenses with the artifacts that contain them.
