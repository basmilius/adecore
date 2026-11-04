# Architecture

A desktop app on ADE CORE runs in three places: the Electron main process, a backend for the long-running work, and one or more windows. Each package runs in one of them; Database has a part in two.

## Three places

| Place | What runs there | Packages |
| --- | --- | --- |
| Main process | The app's lifecycle, its menu, its windows, updates and the guards around each page | [Shell](/shell/), [Service](/service/) |
| Backend | Agent CLIs, language servers, database connections, files | [Agents](/agents/), the host of [Database](/database/), [LSP](/lsp/), [Utils](/utils/) |
| Window | Everything a person sees | [UI](/ui/), [Agent views](/agents-react/), [Editor views](/editor-react/), [Charts](/charts/), [Terminal](/terminal/), the views of [Database](/database/) |

The backend can be the main process itself, an Electron utility process, or a separate Bun or Node process that a [service](/service/) keeps running. The packages work in any of them, because none opens a channel on its own.

## The app owns every channel

No package registers an IPC handler or listens to an app-wide Electron event. A host takes a port or a request and answers it; a view takes a transport. The app connects the two over its own IPC and checks the sender on each channel.

That keeps the security decisions in one place, the app. A package that listened by itself would bypass the app's sender check.

```text
window                         main process or backend
──────                         ───────────────────────
ChatClient ── transport ──▶ app IPC (sender check) ──▶ AgentHost.connect(port)
DatabaseProvider ─ client ─▶ app IPC (sender check) ──▶ host.handle(request, owner)
EditorView ── language service ──▶ LspSession ── transport ──▶ language server
```

- An agent chat: [Agent views](/agents-react/guide/chat-client) talk through a `ChatTransport`. [`AgentHost`](/agents/host) serves a `FramePort` in the backend and starts the provider CLIs.
- A database: the page's client sends requests that the app hands to the host. The host talks to the databases through a native helper, see [Database](/database/guide/getting-started).
- An editor: [Editor views](/editor-react/) ask an injected language service. An [LSP session](/lsp/sessions) can answer it, over a WebSocket from the window or over the stdio of a server process the backend started.

## Contracts in between

What crosses a process boundary is described once, in a package that imports nothing from either side. [Agent contracts](/agent-contracts/) holds the schemas of chats, accounts and usage. The database keeps its protocol in `@adecore/database/protocol`, and the shell keeps the shapes that reach a preload in `@adecore/shell/bridge`, which never imports Electron.

Both sides validate against the same schemas, so a host and a view from the same release always agree.

## Cores without a DOM

The document models run anywhere: [Editor core](/editor-core/), [Merge](/merge/), [Drawing](/drawing/), [Diagram](/diagram/) and [Plan](/plan/). A backend can apply an agent's edit, a test can check it, and a view can draw it, all on the same code.

## One theme

Every view draws on the tokens of `@adecore/ui/theme.css`. The theme is neutral; the app sets its own accent, and light and dark follow `data-theme` on `<html>`. Packages with their own stylesheet, such as the terminal or the editor, read the same tokens. See [Styles](/guide/styles).

## Where to next

- [Choosing packages](/guide/packages) picks the packages for what you build.
- [Installing](/guide/installing) and [Styles](/guide/styles) set up an app.
- Each package's getting started page wires it end to end.
