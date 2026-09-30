# Introduction

This repository holds the packages two or more desktop apps share, so the parts they have in common are written once.

| Package | What it holds |
|---|---|
| [`@basmilius/desktop-ui`](/desktop-ui/) | React components, a theme, formatters and a settings dialog |

## One version

Every package is released under the same version, from one tag. Take them together: a version of one package is tested against the same version of the others.

While the version is `0.x`, a breaking change bumps the minor and everything else the patch. The release notes on GitHub name each breaking change with what to do about it.

## Installing

Every package comes from npm and is installed on its own:

```sh
bun add @basmilius/desktop-ui
```

The page of a package says which peer dependencies it expects and how to wire it into an app.

## Working on a local checkout

Every package has a `source` export condition that points into its `src`, so an app can use a checkout without building it after every change. Link the package from its own folder:

```sh
# in packages/<name> of the desktop checkout
bun link

# in your app
bun link @basmilius/<name>
```

Then turn the condition on wherever the app resolves modules: `resolve.conditions` in Vite, `customConditions` in TypeScript and `--conditions=source` for `bun test`. A package's own page lists what else it needs, such as a single copy of React.
