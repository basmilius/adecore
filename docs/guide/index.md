# Introduction

ADE CORE holds the packages that desktop apps for working with agents share: the interface, the chat with an agent, an editor, a terminal and the platform around them. Each package installs on its own, and all of them release under one version.

## How these docs are organized

- The **Guide** covers what holds for every package: [choosing packages](/guide/packages), [installing](/guide/installing), [styles](/guide/styles) and the [React Compiler](/guide/react-compiler).
- **Packages** has a section per package. Each starts with an overview and a getting started page, followed by guides on one topic each.
- **Reference** lists every name each package exports, read from the source, with a link to the page that explains it.

## What every package shares

- React 19 and Tailwind 4 for every view, on the theme of `@adecore/ui`.
- TypeScript sources that an app can read straight from a checkout, see [Installing](/guide/installing#working-on-a-local-checkout).
- No work at import time and no global listeners: the app wires what a package needs.
- One version for all packages. Upgrade them together.

## Next

Start with [Choosing packages](/guide/packages) to find the packages for what you build, then [Installing](/guide/installing) and [Styles](/guide/styles).
