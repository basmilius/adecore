# Troubleshooting

Most problems come from the setup around the packages: styles, duplicate dependencies or a linked checkout.

## Components render unstyled

Tailwind did not scan the package. Add an `@source` line for every package whose components carry utility classes, relative to the CSS file. With a linked checkout, scan `src` instead of `dist`. [Styles](/guide/styles) lists which packages need one.

## Colors are wrong or missing

The app imports the theme after a package's stylesheet, or not at all. Import Tailwind first, then `@adecore/ui/theme.css`, then each package's own stylesheet. The theme also resets Tailwind's palette, so a utility such as `bg-red-500` does not exist; use the [tokens](/ui/guide/theme).

## "Invalid hook call" or words that show their keys

Two copies of React or i18next are loaded, usually from a linked checkout with its own `node_modules`. Dedupe them in Vite:

```ts
resolve: {
    dedupe: ['react', 'react-dom', 'i18next', 'react-i18next', '@base-ui/react']
}
```

Words also show as keys when `UIProvider` is missing, so the `ui` namespace never reached your i18next instance. See [Getting started](/ui/guide/getting-started#wrap-the-app-in-uiprovider).

## Vite refuses to serve a file from the checkout

Vite only serves files below the project root. Add the checkout's folder to `server.fs.allow`.

## Types fail on a linked checkout

With the `source` condition, the app type-checks the library's TypeScript. Set `customConditions: ["source"]`, `allowImportingTsExtensions`, `resolveJsonModule` and `"jsx": "react-jsx"` in the app's `tsconfig.json`. See [Installing](/guide/installing#working-on-a-local-checkout).

## Views redraw more often with the sources

The `source` condition serves code the React Compiler has not run over. Run the compiler over those sources, or use the built `dist`. See [React Compiler](/guide/react-compiler).

## A chat, database or editor never answers

The packages register no IPC channel, so nothing answers until the app wires one. Check that the app's handler reaches the host and that its sender check lets the window through. [Architecture](/guide/architecture#the-app-owns-every-channel) shows what connects to what.

## Packages disagree after an upgrade

Every package releases under one version and is tested against the same version of the others. Upgrade them together, and read the release notes for breaking changes; while the version is `0.x`, those bump the minor.
