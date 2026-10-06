---
layout: home
titleTemplate: false

hero:
    text: Packages for desktop apps
    tagline: What desktop apps for working with agents share, on Electron, React 19 and Tailwind 4, released together under one version.
    actions:
        -   theme: brand
            text: Get started
            link: /guide/
        -   theme: alt
            text: UI
            link: /ui/
        -   theme: alt
            text: GitHub
            link: https://github.com/basmilius/adecore
---

## Interface

- [UI](/ui/): menus, dialogs, tooltips, fields, toasts, a settings dialog, keyboard shortcuts and formatters, drawn from one theme on Base UI.
- [Terminal](/terminal/): a terminal pane on xterm.js in the colors of the theme. It fits its container and is fed by the app through a handle.

## Desktop

- [Shell](/shell/): the main process of an Electron app whose page draws its own interface. The menu the page builds, an updater it watches, windows that open where they were left and the guards around its bridge.
- [Service](/service/): a launchd job on macOS or a systemd user service on Linux, defined once and managed through injected system calls.

## Agents

- [Agent contracts](/agent-contracts/): the schemas and ports that agent hosts and views share.
- [Agents](/agents/): chat hosts for Node and Bun over provider CLIs, with accounts, usage and task coordination.
- [Agent views](/agents-react/): React views for agent chats, from the thread and the composer to approvals, accounts and usage.

## Editor

- [Editor core](/editor-core/): the document model, with selections, undo history, search and folding, and no DOM.
- [Editor](/editor/): the DOM view that draws a document model.
- [Editor views](/editor-react/): React editors with completion, hovers, diagnostics, navigation and change review over an injected language service.
- [LSP](/lsp/): a Language Server Protocol client with no DOM.
- [Merge](/merge/): line diffs and three-way merge blocks for resolving conflicts in text.

## Data

- [Database](/database/): browse, query and edit SQLite and MySQL databases. React views for the page, a host for the backend and a native helper that talks to the servers.

## Canvas

- [Drawing](/drawing/): drawing schemas, geometry, paths, SVG export and reading order.
- [Diagram](/diagram/): directed graphs on top of drawing, with layered layout and SVG export.
- [Plan](/plan/): plan trees with atomic operations, permissions for people and agents, and Markdown.
