<a href="https://bas.dev" target="_blank" rel="noopener">
    <img src="https://bmcdn.nl/assets/branding/logo.svg" alt="Bas Milius logo" height="60" width="60" />
</a>

---

# adecore

[![CI](https://github.com/basmilius/adecore/actions/workflows/ci.yml/badge.svg)](https://github.com/basmilius/adecore/actions/workflows/ci.yml)
[![ui on npm](https://img.shields.io/npm/v/@adecore/ui?label=ui)](https://www.npmjs.com/package/@adecore/ui)
[![shell on npm](https://img.shields.io/npm/v/@adecore/shell?label=shell)](https://www.npmjs.com/package/@adecore/shell)
[![terminal on npm](https://img.shields.io/npm/v/@adecore/terminal?label=terminal)](https://www.npmjs.com/package/@adecore/terminal)
[![Docs](https://img.shields.io/badge/docs-adecore.dev-blue)](https://adecore.dev)

Shared packages for development apps on Electron, React 19 and Tailwind 4. UI and terminal views, agent hosts and chat, database tooling, editors, language services, drawing and diagram cores, merge algorithms and user service managers follow one release version.

The documentation is at **[adecore.dev](https://adecore.dev)**, with a live demo of every component. The [introduction](https://adecore.dev/guide/) is the place to start.

## Packages

| Package                                                        | What it holds                                                                                                                                                                                   | Docs                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`@adecore/ui`](packages/ui)                                   | For the page. React components, a theme of tokens, keyboard shortcuts, a settings dialog and formatters for numbers and dates, on Base UI and Lucide.                                           | [ui](https://adecore.dev/ui/)                                   |
| [`@adecore/terminal`](packages/terminal)                       | A terminal pane on xterm.js in the colors of the theme, fed by the app through a handle.                                                                                                        | [terminal](https://adecore.dev/terminal/)                       |
| [`@adecore/shell`](packages/shell)                             | For the main process. The application menu the page builds, an updater the page watches, windows that open where they were left, the page's theme on its window and the guards around the page. | [shell](https://adecore.dev/shell/)                             |
| [`@adecore/database`](packages/database)                       | React database views, backend host and native database helpers.                                                                                                                                 | [database](https://adecore.dev/database/)                       |
| [`@adecore/agent-contracts`](packages/agent-contracts)         | Schemas and transport contracts for agents.                                                                                                                                                     | [agent-contracts](https://adecore.dev/agent-contracts/)         |
| [`@adecore/agents`](packages/agents)                           | Node-compatible chat hosts, providers, accounts, usage and task coordination.                                                                                                                   | [agents](https://adecore.dev/agents/)                           |
| [`@adecore/agents-react`](packages/agents-react)               | Chat, composer, approvals, provider and usage views with host adapters.                                                                                                                         | [agents-react](https://adecore.dev/agents-react/)               |
| [`@adecore/merge`](packages/merge)                             | Pure diff and conflict algorithms.                                                                                                                                                              | [merge](https://adecore.dev/merge/)                             |
| [`@adecore/drawing`](packages/drawing)                         | Drawing schemas, geometry and rendering.                                                                                                                                                        | [drawing](https://adecore.dev/drawing/)                         |
| [`@adecore/diagram`](packages/diagram)                         | Diagram schemas, graph layout and SVG rendering.                                                                                                                                                | [diagram](https://adecore.dev/diagram/)                         |
| [`@adecore/plan`](packages/plan)                               | Plan schemas, task trees, operation permissions and Markdown conversion.                                                                                                                        | [plan](https://adecore.dev/plan/)                               |
| [`@adecore/service`](packages/service)                         | Injectable launchd and systemd user service managers.                                                                                                                                           | [service](https://adecore.dev/service/)                         |
| [`@adecore/editor-core`](packages/editor-core)                 | Document model, edits, selections and history.                                                                                                                                                  | [editor core](https://adecore.dev/editor-core/)                 |
| [`@adecore/editor`](packages/editor)                           | Browser editor engine, rendering, keymaps and syntax highlighting.                                                                                                                              | [editor](https://adecore.dev/editor/)                           |
| [`@adecore/lsp`](packages/lsp)                                 | Language service contracts, JSON-RPC client, transports and fakes.                                                                                                                              | [LSP](https://adecore.dev/lsp/)                                 |
| [`@adecore/editor-react`](packages/editor-react)               | Language feature coordination, React popups and review displays.                                                                                                                                | [editor views](https://adecore.dev/editor-react/)               |

Newly transferred packages stay private at `0.0.0` until their first npm publication and Trusted Publishing setup are complete. The editor family preserves its current implementation and documented remaining work.

```sh
bun add @adecore/ui
bun add @adecore/shell
bun add @adecore/terminal
```

Take them at the same version, since each version is tested against the same version of the others. While the version is `0.x`, a breaking change bumps the minor and anything else the patch. The [release notes](https://github.com/basmilius/adecore/releases) name every breaking change with what to do about it.

Up to `0.13.x` the packages were `@basmilius/desktop-ui` and `@basmilius/desktop-shell`. From `0.14.0` they are `@adecore/ui` and `@adecore/shell`, with the same API; replacing the names in imports and in `package.json` is the whole migration.

## For coding agents

The docs site serves [`llms.txt`](https://adecore.dev/llms.txt) as an index of every page and [`llms-full.txt`](https://adecore.dev/llms-full.txt) with every page in one file. Each page is also plain Markdown at its own URL plus `.md`, such as [`/ui/actions/button.md`](https://adecore.dev/ui/actions/button.md).

## Development

The repository is a Bun workspace. `packages` holds one folder per package, and `docs` holds the VitePress site.

```sh
bun install
bun run build             # dependency-ordered JavaScript and declaration builds
bun run check             # typecheck and oxlint, a warning fails
bun run test              # unit tests, the docs and demos included
bun run test:pack         # tarballs, exports and isolated Node/Bun consumer smoke tests
bun run format            # oxfmt
bun run --cwd docs build  # the docs site
```

Tests sit next to the code. `packages/ui/src/__snapshots__/exports.test.ts.snap` lists every exported name, so a diff there is an API change; accept it with `bun test --update-snapshots` when you meant it. `docs/docs.test.ts` fails when an export appears on no page of the docs, so a new export comes with its docs.

An app can use a checkout of this repository without a build per change. Every package has a `source` export condition that points into its `src`; [Working on a local checkout](https://adecore.dev/guide/#working-on-a-local-checkout) shows how to link it.

## Releases

A release starts as a draft GitHub release, and [`release.yml`](.github/workflows/release.yml) runs by hand for its version. It tags the commit, sets the version in every package and runs check, test and build. It normalizes internal dependencies to the release version, validates packed artifacts, then publishes public packages in dependency order through Trusted Publishing, with provenance, and deploys the docs. Database platform binaries precede the host package. Private packages are skipped; a public package cannot depend on a private workspace. A prerelease goes out under the `next` dist-tag and uploads the docs without making them live. The workflow publishes the GitHub release last, because a published release is immutable. Every `package.json` in the repository stays at `0.0.0`.

## Issues

Use a template: a [bug](https://github.com/basmilius/adecore/issues/new?template=bug.yml) for a component or shell API that does not do what its docs or its types say, a [request](https://github.com/basmilius/adecore/issues/new?template=request.yml) for something an app needs. A request describes the need. The answer may be a different API than the one proposed, or a no when the need belongs in the app.

## License

Existing packages retain [MIT](LICENSE). Transferred TypeScript packages retain their package-local FSL-1.1-MIT license and provenance. Check each package's `license` field and `LICENSE` before redistribution. A publication must not silently change those licenses.
