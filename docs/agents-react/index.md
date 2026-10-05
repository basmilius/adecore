# React agent chats

`@adecore/agents-react` provides virtualized chat threads, a CodeMirror prompt composer, approval and question cards, provider account settings, and usage views. It builds on React 19, `@adecore/ui`, and `@adecore/agent-contracts`. Import a component or helper by its public subpath; this package has no root entrypoint.

The host supplies the connection, file access, permissions, account login, navigation, and any extra UI. The React package does not launch provider processes or register IPC handlers. Keep backend imports in a separate process. See [agent contracts](/agent-contracts/) for the shared data and [agent hosts](/agents/) for backend execution.

## Start here

1. [Installation and setup](./getting-started) configures storage, translations, a port adapter, and a scope.
2. [Host adapters](./host) explains the shared `ChatHost` and its optional controls.
3. [Chat state and lifecycle](./chat-lifecycle) mounts a thread and composer, handles sends, and releases subscriptions.

## Build a chat

- [Composer](./composer) covers keyboard behavior, model changes, drafts, queues, and slots.
- [Attachments and mentions](./attachments) covers uploads, resource adapters, search, and drag compatibility.
- [Messages and timeline](./timeline) covers virtualization, streamed text, tools, diffs, bookmarks, and thread cards.
- [Approvals and tasks](./approvals-tasks) covers pending requests, question drafts, refusals, and child conversations.
- [Accounts and models](./accounts-models) covers provider discovery, settings, login, and remembered choices.
- [Usage](./usage) covers summaries, transcript provenance, account filters, and plan limits.

## Integrate and verify

- [Persistence](./persistence) explains setup order, record formats, raw migration, and storage failures.
- [CSS, theme, and translations](./styling) covers linked source, compiled packages, workers, and locale loading.
- [Testing](./testing) provides safe checks with fake providers and fresh storage processes.
- [Migration](./migration) keeps records, transport shapes, and mention drags compatible.
- [Troubleshooting](./troubleshooting) maps visible symptoms to setup and ownership errors.

## Find an entrypoint

The [runtime reference](./reference-runtime), [chat reference](./reference-chat), and [settings reference](./reference-settings) group every public module by its role. They include lower-level modules for custom compositions; most hosts start with `Timeline`, `Composer`, and `ChatScopeContext`.

The package is private at `0.0.0` pending publication setup. Use the local checkout today; [setup](./getting-started#local-checkout-and-compiled-use) explains both source and compiled exports. The transferred code retains FSL-1.1-MIT. Read the [package license](https://github.com/basmilius/adecore/blob/main/packages/agents-react/LICENSE) before redistribution.
