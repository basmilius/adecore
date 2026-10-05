<a href="https://bas.dev" target="_blank" rel="noopener">
    <img src="https://bmcdn.nl/assets/branding/logo.svg" alt="Bas Milius logo" height="60" width="60" />
</a>

---

# adecore

[![CI](https://github.com/basmilius/adecore/actions/workflows/ci.yml/badge.svg)](https://github.com/basmilius/adecore/actions/workflows/ci.yml)
[![ui on npm](https://img.shields.io/npm/v/@adecore/ui?label=ui)](https://www.npmjs.com/package/@adecore/ui)
[![shell on npm](https://img.shields.io/npm/v/@adecore/shell?label=shell)](https://www.npmjs.com/package/@adecore/shell)
[![Docs](https://img.shields.io/badge/docs-adecore.dev-blue)](https://adecore.dev)

Packages for desktop apps on Electron, React 19 and Tailwind 4. One package draws the page, the other runs the main process. Both are released together, under one version.

The documentation is at **[adecore.dev](https://adecore.dev)**, with a live demo of every component. The [introduction](https://adecore.dev/guide/) is the place to start.

## Packages

| Package | What it holds | Docs |
|---|---|---|
| [`@adecore/ui`](packages/ui) | For the page. React components, a theme of tokens, keyboard shortcuts, a settings dialog and formatters for numbers and dates, on Base UI and Lucide. | [ui](https://adecore.dev/ui/) |
| [`@adecore/shell`](packages/shell) | For the main process. The application menu the page builds, an updater the page watches, windows that open where they were left, the page's theme on its window and the guards around the page. | [shell](https://adecore.dev/shell/) |

```sh
bun add @adecore/ui
bun add @adecore/shell
```

Take both at the same version, since each version is tested against the same version of the other. While the version is `0.x`, a breaking change bumps the minor and anything else the patch. The [release notes](https://github.com/basmilius/adecore/releases) name every breaking change with what to do about it.

Up to `0.13.x` the packages were `@basmilius/desktop-ui` and `@basmilius/desktop-shell`. From `0.14.0` they are `@adecore/ui` and `@adecore/shell`, with the same API; replacing the names in imports and in `package.json` is the whole migration.

## For coding agents

The docs site serves [`llms.txt`](https://adecore.dev/llms.txt) as an index of every page and [`llms-full.txt`](https://adecore.dev/llms-full.txt) with every page in one file. Each page is also plain Markdown at its own URL plus `.md`, such as [`/ui/actions/button.md`](https://adecore.dev/ui/actions/button.md).

## Development

The repository is a Bun workspace. `packages` holds one folder per package, and `docs` holds the VitePress site.

```sh
bun install
bun run check             # typecheck and oxlint, a warning fails
bun run test              # every test, the docs and the demos included
bun run build             # dist of every package
bun run format            # oxfmt
bun run --cwd docs build  # the docs site
```

Tests sit next to the code. `packages/ui/src/__snapshots__/exports.test.ts.snap` lists every exported name, so a diff there is an API change; accept it with `bun test --update-snapshots` when you meant it. `docs/docs.test.ts` fails when an export appears on no page of the docs, so a new export comes with its docs.

An app can use a checkout of this repository without a build per change. Every package has a `source` export condition that points into its `src`; [Working on a local checkout](https://adecore.dev/guide/#working-on-a-local-checkout) shows how to link it.

## Releases

A published GitHub release runs [`release.yml`](.github/workflows/release.yml). It sets the version from the tag in every package and runs check, test and build. Then it publishes each package to npm through Trusted Publishing, with provenance, and deploys the docs. A prerelease goes out under the `next` dist-tag and uploads the docs without making them live. Every `package.json` in the repository stays at `0.0.0`.

## Issues

Use a template: a [bug](https://github.com/basmilius/adecore/issues/new?template=bug.yml) for a component or shell API that does not do what its docs or its types say, a [request](https://github.com/basmilius/adecore/issues/new?template=request.yml) for something an app needs. A request describes the need. The answer may be a different API than the one proposed, or a no when the need belongs in the app.

## License

[MIT](LICENSE)
