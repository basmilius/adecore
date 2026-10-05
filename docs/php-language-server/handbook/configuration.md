# Configuration, Composer and stubs

Settings arrive through `initializationOptions`, `workspace/configuration` for the `phpLanguageServer` section, or `workspace/didChangeConfiguration`. The parser accepts a bare settings object or the same object nested under `phpLanguageServer`.

```json
{
    "phpLanguageServer": {
        "phpVersion": "8.4",
        "storagePath": "/cache/php-server",
        "stubsPath": "/cache/php-stubs/pinned-commit",
        "inlayHints": { "parameterNames": true, "closureTypes": false },
        "inspections": {
            "unused-import": "off",
            "undefined-class": "warning",
            "deprecated": { "severity": "hint" }
        },
        "format": { "lineLength": 100, "alignAssignments": false, "editorconfig": true }
    }
}
```

The paths are host-provided examples. Use real authorized directories and the exact stub commit your installed binary expects. Setting `storagePath` can cause the server to fetch stubs in the background when no explicit `stubsPath` is provided; importing the Node package never does.

## Settings reference

| Key                         | Default or meaning                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `phpVersion`                | Fallback language level. Composer's project level wins; otherwise the newest supported level is 8.5. |
| `storagePath`               | Optional cache/stub storage. Without it, no persistent cache and no automatic stub fetch.            |
| `stubsPath`                 | Explicit existing phpstorm-stubs folder, used instead of automatic fetch.                            |
| `inlayHints.parameterNames` | `true` by default.                                                                                   |
| `inlayHints.closureTypes`   | `true` by default.                                                                                   |
| `inspections`               | Per-code switches and severities; absent entries retain their own defaults.                          |
| `format`                    | Formatter settings, described below.                                                                 |

`workspace/configuration` requests use each document URI as `scopeUri`, allowing document/project-specific language levels, inspections and formatting. Inlay-hint switches use the global initialization or pushed configuration, not the current document-scoped response. Supply storage/stub directories during initialization. The current `didChangeConfiguration` handler does not change them; changing the host's storage requires a process restart with new initialization options.

## Language level and Composer

The project level is `config.platform.php`, else the lower bound of `require.php`, else client configuration, else 8.5. Supported constraints include common caret/tilde, inequalities, wildcards, alternatives and hyphen ranges. The parser reads supported syntax before the level pass diagnoses newer, removed or deprecated constructs.

Installed declarations come from Composer metadata and PSR-4/PSR-0 autoload maps. Project declarations win over packages, and packages over standard-library stubs. Missing classes can be read on demand through autoload maps. This is analysis; the server does not run Composer or install packages. Authoritative classmaps and `files` lookup by name remain incomplete.

Standard-library extension folders include the default extension set plus `ext-*` requirements. Stubs are filtered by the project's language level using their availability metadata. A project targeting 8.1 should not receive functions introduced later. The `@since` of a project's own declarations is not treated as a language-level filter.

## Stub and cache lifetime

The pinned phpstorm-stubs revision is recorded in `PHP_LANGUAGE_SERVER_METADATA`, `native-source.json` and `crates/index/src/stubs.rs`. Stubs are not bundled. With storage and no explicit stub path, the server fetches that commit into `<storagePath>/stubs/<commit>`, retains PHP files and the upstream LICENSE, and marks complete only after successful extraction. An interrupted fetch restarts later; network failure logs through `window/logMessage` and leaves project analysis running without standard-library data.

For offline or permission-controlled operation, preinstall the authorized pinned stubs and pass `stubsPath`. Keep the upstream Apache-2.0 license and installation marker. If both paths are absent, project features work but standard-library completion/navigation can be missing.

Project caches live under `<storagePath>/cache`. They track path, size, modification time and content hash and invalidate when source metadata affecting declaration meaning changes. A touched-but-unchanged file can avoid reparsing. Open documents still take precedence. Preserve the host's cache namespace in a migration, but let the server reject an incompatible cache rather than rewriting it manually.

## Formatting settings

| `format` key               | Accepted value                             | Default    |
| -------------------------- | ------------------------------------------ | ---------- |
| `classBrace`               | `nextLine` or `sameLine`                   | `nextLine` |
| `functionBrace`            | `nextLine` or `sameLine`                   | `nextLine` |
| `blankLinesBetweenMembers` | Nonnegative integer                        | `1`        |
| `alignAssignments`         | Boolean                                    | `false`    |
| `alignArrayArrows`         | Boolean                                    | `false`    |
| `lineLength`               | Nonnegative integer; `0` disables wrapping | `120`      |
| `editorconfig`             | Boolean                                    | `true`     |

Client formatting options provide tab size and spaces/tabs. `.editorconfig` overrides that indentation and line length using nearer matching files up to `root=true`; explicit format settings override its corresponding values. Supported EditorConfig keys are `indent_style`, `indent_size`, `tab_width` and `max_line_length`. Document-scoped format settings override global ones. The current EditorConfig enable/disable decision reads the global format setting, so set that switch globally rather than relying on a document-scoped response.

An inspection value can be `true`/`false`, `off`, a severity (`error`, `warning`, `information`, `hint`), or `{ "enabled": false, "severity": "warning" }`. Unknown/invalid setting values do not create new capabilities; check the implementation's inspection catalog when choosing a code.
