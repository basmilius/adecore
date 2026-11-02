# Installing

Install each package from npm on its own:

```sh
bun add @adecore/ui
```

Each package page lists its peer dependencies and how to wire it into an app.

## One version

Every package is released under the same version, from one tag, and tested against the same version of the others. Upgrade them together.

While the version is `0.x`, a breaking change bumps the minor and everything else the patch. The GitHub release notes say how to migrate each breaking change.

## Working on a local checkout

Every package has a `source` export condition that points into its `src`, so an app can use a checkout without building it. Link the package from its own folder:

```sh
# in packages/<name> of the adecore checkout
bun link

# in your app
bun link @adecore/<name>
```

Then turn the condition on wherever the app resolves modules: `resolve.conditions` in Vite, `customConditions` in TypeScript and `--conditions=source` for `bun test`. A package page lists what else it needs, such as a single copy of React.

The sources are uncompiled TypeScript. Read [React Compiler](/guide/react-compiler) before you ship a build that uses them.
