# Introduction

The packages that desktop apps for working with agents share.

## Packages

### Interface

| Package | What it holds |
|---|---|
| [UI](/ui/) (`@adecore/ui`) | React components, a theme, formatters and a settings dialog |
| [Terminal](/terminal/) (`@adecore/terminal`) | A terminal pane on xterm.js in the colors of the theme, fed by the app through a handle |

### Desktop

| Package | What it holds |
|---|---|
| [Shell](/shell/) (`@adecore/shell`) | The main process of an Electron app: its menu, its updater, its windows and the guards around its page |
| [Service](/service/) (`@adecore/service`) | Definitions and managers for a launchd job on macOS or a systemd user service on Linux |

### Agents

| Package | What it holds |
|---|---|
| [Agent contracts](/agent-contracts/) (`@adecore/agent-contracts`) | Schemas and port contracts for agent chats, provider accounts, models and usage |
| [Agents](/agents/) (`@adecore/agents`) | Chat hosts for Node and Bun over provider CLIs, with accounts, usage and task coordination |
| [Agent views](/agents-react/) (`@adecore/agents-react`) | React views for agent chats: threads, the composer, approvals, provider accounts and usage |
| [Intelligent UI](/intelligent-ui/) (`@adecore/intelligent-ui`) | The component catalog, compiler and bounded interpreter for blocks of UI in an agent's reply |

### Editor

| Package | What it holds |
|---|---|
| [Editor core](/editor-core/) (`@adecore/editor-core`) | The document model: text, selections, undo history, search, folding and editing commands, with no DOM |
| [Editor](/editor/) (`@adecore/editor`) | The DOM view that draws a document model |
| [Editor views](/editor-react/) (`@adecore/editor-react`) | React editors with language features, popups and change review over an injected language service |
| [LSP](/lsp/) (`@adecore/lsp`) | A Language Server Protocol client with no DOM, and the language service interface the editor asks |
| [Merge](/merge/) (`@adecore/merge`) | Line diffs, three-way merge blocks and conflict resolution for text |

### Data

| Package | What it holds |
|---|---|
| [Database](/database/) (`@adecore/database`) | Views to browse, query and edit SQLite and MySQL databases, a host for the backend and a native helper |

### Canvas

| Package | What it holds |
|---|---|
| [Drawing](/drawing/) (`@adecore/drawing`) | Drawing schemas, geometry, paths, SVG export and reading order |
| [Diagram](/diagram/) (`@adecore/diagram`) | Directed graphs on top of drawing, with layered layout and SVG export |
| [Plan](/plan/) (`@adecore/plan`) | Plan trees with atomic operations, permissions for people and agents, and Markdown |

## One version

Every package is released under the same version, from one tag, and tested against the same version of the others. Upgrade them together.

While the version is `0.x`, a breaking change bumps the minor and everything else the patch. The GitHub release notes say how to migrate each breaking change.

## Installing

Install each package from npm on its own:

```sh
bun add @adecore/ui
```

Each package page lists its peer dependencies and how to wire it into an app.

## Working on a local checkout

Every package has a `source` export condition that points into its `src`, so an app can use a checkout without building it. Link the package from its own folder:

```sh
# in packages/<name> of the adecore checkout
bun link

# in your app
bun link @adecore/<name>
```

Then turn the condition on wherever the app resolves modules: `resolve.conditions` in Vite, `customConditions` in TypeScript and `--conditions=source` for `bun test`. A package page lists what else it needs, such as a single copy of React.

## The React Compiler

The packages with React views (UI, Terminal, Agent views and Editor views) ship a `dist` built with the [React Compiler](https://react.dev/learn/react-compiler), so their components and hooks memoize themselves. The compiled code imports `react/compiler-runtime`, which comes with React 19.

The `source` condition serves uncompiled TypeScript, which has no hand-written `useMemo` or `useCallback`. Without the compiler the views still work, but redraw whenever their parent does. To keep the memoization, run `babel-plugin-react-compiler` with `target: '19'` over these sources, in Vite through `reactCompilerPreset` of `@vitejs/plugin-react`. If your bundler setup skips `node_modules`, include the `src` of these packages. A production build without the `source` condition uses the compiled `dist`.

A function that starts with `'use no memo'` stays uncompiled, in `dist` too, and so does one the compiler cannot prove safe.
