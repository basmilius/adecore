<a href="https://bas.dev" target="_blank" rel="noopener">
    <img src="https://bmcdn.nl/assets/branding/logo.svg" alt="Bas Milius logo" height="60" width="60" />
</a>

---

# Desktop

[![CI](https://github.com/basmilius/desktop/actions/workflows/ci.yml/badge.svg)](https://github.com/basmilius/desktop/actions/workflows/ci.yml)
[![desktop-ui on npm](https://img.shields.io/npm/v/@basmilius/desktop-ui?label=desktop-ui)](https://www.npmjs.com/package/@basmilius/desktop-ui)
[![desktop-shell on npm](https://img.shields.io/npm/v/@basmilius/desktop-shell?label=desktop-shell)](https://www.npmjs.com/package/@basmilius/desktop-shell)
[![Docs](https://img.shields.io/badge/docs-desktop.bas.dev-blue)](https://desktop.bas.dev)

Packages for desktop apps on Electron, React 19 and Tailwind 4. One package draws the page, the other runs the main process. Both are released together, under one version.

The documentation is at **[desktop.bas.dev](https://desktop.bas.dev)**, with a live demo of every component. The [introduction](https://desktop.bas.dev/guide/) is the place to start.

## Packages

| Package | What it holds | Docs |
|---|---|---|
| [`@basmilius/desktop-ui`](packages/desktop-ui) | For the page. React components, a theme of tokens, keyboard shortcuts, a settings dialog and formatters for numbers and dates, on Base UI and Lucide. | [desktop-ui](https://desktop.bas.dev/desktop-ui/) |
| [`@basmilius/desktop-shell`](packages/desktop-shell) | For the main process. The application menu the page builds, an updater the page watches, windows that open where they were left, the page's theme on its window and the guards around the page. | [desktop-shell](https://desktop.bas.dev/desktop-shell/) |

```sh
bun add @basmilius/desktop-ui
bun add @basmilius/desktop-shell
```

Take both at the same version, since each version is tested against the same version of the other. While the version is `0.x`, a breaking change bumps the minor and anything else the patch. The [release notes](https://github.com/basmilius/desktop/releases) name every breaking change with what to do about it.

## For coding agents

The docs site serves [`llms.txt`](https://desktop.bas.dev/llms.txt) as an index of every page and [`llms-full.txt`](https://desktop.bas.dev/llms-full.txt) with every page in one file. Each page is also plain Markdown at its own URL plus `.md`, such as [`/desktop-ui/actions/button.md`](https://desktop.bas.dev/desktop-ui/actions/button.md).

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

Tests sit next to the code. `packages/desktop-ui/src/__snapshots__/exports.test.ts.snap` lists every exported name, so a diff there is an API change; accept it with `bun test --update-snapshots` when you meant it. `docs/docs.test.ts` fails when an export appears on no page of the docs, so a new export comes with its docs.

An app can use a checkout of this repository without a build per change. Every package has a `source` export condition that points into its `src`; [Working on a local checkout](https://desktop.bas.dev/guide/#working-on-a-local-checkout) shows how to link it.

## Releases

A published GitHub release runs [`release.yml`](.github/workflows/release.yml). It sets the version from the tag in every package and runs check, test and build. Then it publishes each package to npm through Trusted Publishing, with provenance, and deploys the docs. A prerelease goes out under the `next` dist-tag and uploads the docs without making them live. Every `package.json` in the repository stays at `0.0.0`.

## Issues

Use a template: a [bug](https://github.com/basmilius/desktop/issues/new?template=bug.yml) for a component or shell API that does not do what its docs or its types say, a [request](https://github.com/basmilius/desktop/issues/new?template=request.yml) for something an app needs. A request describes the need. The answer may be a different API than the one proposed, or a no when the need belongs in the app.

## License

[MIT](LICENSE)
