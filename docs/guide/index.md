# Introduction

The packages that desktop apps for working with agents share. Each one installs on its own, and all of them release under one version.

The packages build on each other in layers. A contract package holds the shapes, a host runs in the backend, and a React package draws the views. The editor goes from a document model without a DOM, through a DOM view, to React editors with language features. Every view draws on the theme of `@adecore/ui`.

## Interface

| Package | What it holds |
|---|---|
| [UI](/ui/) (`@adecore/ui`) | React components, a theme, formatters and a settings dialog |
| [Charts](/charts/) (`@adecore/charts`) | Series, heatmaps, timelines and sparklines, drawn as SVG on the theme |
| [Terminal](/terminal/) (`@adecore/terminal`) | A terminal pane on xterm.js in the colors of the theme, fed by the app through a handle |

## Agents

| Package | What it holds |
|---|---|
| [Agent contracts](/agent-contracts/) (`@adecore/agent-contracts`) | Schemas and port contracts for agent chats, provider accounts, models and usage |
| [Agents](/agents/) (`@adecore/agents`) | Chat hosts for Node and Bun over provider CLIs, with accounts, usage and task coordination |
| [Agent views](/agents-react/) (`@adecore/agents-react`) | React views for agent chats: threads, the composer, approvals, provider accounts and usage |
| [Intelligent UI](/intelligent-ui/) (`@adecore/intelligent-ui`) | The component catalog, compiler and bounded interpreter for blocks of UI in an agent's reply |

## Editor

| Package | What it holds |
|---|---|
| [Editor core](/editor-core/) (`@adecore/editor-core`) | The document model: text, selections, undo history, search, folding and editing commands, with no DOM |
| [Editor](/editor/) (`@adecore/editor`) | The DOM view that draws a document model |
| [Editor views](/editor-react/) (`@adecore/editor-react`) | React editors with language features, popups and change review over an injected language service |
| [LSP](/lsp/) (`@adecore/lsp`) | A Language Server Protocol client with no DOM, and the language service interface the editor asks |
| [Merge](/merge/) (`@adecore/merge`) | Line diffs, three-way merge blocks and conflict resolution for text |

## Platform

| Package | What it holds |
|---|---|
| [Shell](/shell/) (`@adecore/shell`) | The main process of an Electron app: its menu, its updater, its windows and the guards around its page |
| [Service](/service/) (`@adecore/service`) | Definitions and managers for a launchd job on macOS or a systemd user service on Linux |
| [Database](/database/) (`@adecore/database`) | Views to browse, query and edit SQLite and MySQL databases, a host for the backend and a native helper |

## Canvas

| Package | What it holds |
|---|---|
| [Drawing](/drawing/) (`@adecore/drawing`) | Drawing schemas, geometry, paths, SVG export and reading order |
| [Diagram](/diagram/) (`@adecore/diagram`) | Directed graphs on top of drawing, with layered layout and SVG export |
| [Plan](/plan/) (`@adecore/plan`) | Plan trees with atomic operations, permissions for people and agents, and Markdown |

## Next

[Installing](/guide/installing) covers versions and a local checkout, [Styles](/guide/styles) the CSS each package needs, and [React Compiler](/guide/react-compiler) what changes when an app reads the sources.
