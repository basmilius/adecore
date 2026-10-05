# Introduction

This repository holds the packages that desktop apps for working with agents share, so the parts they have in common are written once.

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

### Editor

| Package | What it holds |
|---|---|
| [Editor core](/editor-core/) (`@adecore/editor-core`) | The document model: text, selections, undo history, search, folding and editing commands, with no DOM |
| [Editor](/editor/) (`@adecore/editor`) | The DOM view that draws a document model |
| [Editor views](/editor-react/) (`@adecore/editor-react`) | React editors with language features, popups and change review over an injected language service |
| [LSP](/lsp/) (`@adecore/lsp`) | A Language Server Protocol client with no DOM, and the language service interface the editor asks |
| [PHP language server](/php-language-server/) (`@adecore/php-language-server`) | A native PHP language server over stdio, with the metadata to find or pin its binary |
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

Every package is released under the same version, from one tag. Take them together: a version of one package is tested against the same version of the others.

While the version is `0.x`, a breaking change bumps the minor and everything else the patch. The release notes on GitHub name each breaking change with what to do about it.

## Installing

Every package comes from npm and is installed on its own:

```sh
bun add @adecore/ui
```

The page of a package says which peer dependencies it expects and how to wire it into an app.

## Working on a local checkout

Every package has a `source` export condition that points into its `src`, so an app can use a checkout without building it after every change. Link the package from its own folder:

```sh
# in packages/<name> of the adecore checkout
bun link

# in your app
bun link @adecore/<name>
```

Then turn the condition on wherever the app resolves modules: `resolve.conditions` in Vite, `customConditions` in TypeScript and `--conditions=source` for `bun test`. A package's own page lists what else it needs, such as a single copy of React.
