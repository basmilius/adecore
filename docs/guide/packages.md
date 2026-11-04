# Choosing packages

ADE CORE is a set of packages, not a framework. An app installs the ones it needs, and each one installs on its own.

## By what you build

| You build | Start with | Add when you need |
| --- | --- | --- |
| The window of a desktop app | [Shell](/shell/), [UI](/ui/) | [Service](/service/) for a background process |
| A chat with a coding agent | [Agents](/agents/) in the backend, [Agent views](/agents-react/) in the window | [Intelligent UI](/intelligent-ui/) for blocks of UI in replies |
| A code editor | [Editor views](/editor-react/) | [LSP](/lsp/) for a language server, [Merge](/merge/) for conflicts |
| A terminal pane | [Terminal](/terminal/) | [UI](/ui/) for the theme it reads |
| A database browser | [Database](/database/) | |
| Charts of usage or metrics | [Charts](/charts/) | |
| A canvas with drawings, diagrams or plans | [Drawing](/drawing/), [Diagram](/diagram/), [Plan](/plan/) | |

## How they fit together

The packages build on each other in layers:

- A **contract** package holds shapes that cross a process boundary, with no runtime of its own: [Agent contracts](/agent-contracts/).
- A **host** runs in the backend, in Node or Bun: [Agents](/agents/), the host of [Database](/database/) and [Service](/service/).
- A **view** package draws React in the window: [UI](/ui/), [Agent views](/agents-react/), [Editor views](/editor-react/), [Charts](/charts/) and [Terminal](/terminal/).
- A **core** has no DOM, so a backend, a test and a view can all read it: [Editor core](/editor-core/), [Merge](/merge/), [Drawing](/drawing/), [Diagram](/diagram/) and [Plan](/plan/).

Every view draws on the theme of `@adecore/ui`. The editor goes from a document model without a DOM ([Editor core](/editor-core/)), through a DOM view ([Editor](/editor/)), to React editors with language features ([Editor views](/editor-react/)).

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
| [Utils](/utils/) (`@adecore/utils`) | Waits, deadlines, atomic file writes and path checks, with no dependencies |

## Canvas

| Package | What it holds |
|---|---|
| [Drawing](/drawing/) (`@adecore/drawing`) | Drawing schemas, geometry, paths, SVG export and reading order |
| [Diagram](/diagram/) (`@adecore/diagram`) | Directed graphs on top of drawing, with layered layout and SVG export |
| [Plan](/plan/) (`@adecore/plan`) | Plan trees with atomic operations, permissions for people and agents, and Markdown |
