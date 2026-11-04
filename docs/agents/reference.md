# Reference

Every name each entry point exports, types included, read from its source. Anything not listed is internal and may change in any release.

These entries run in the backend, never in a window. A window imports [`@adecore/agent-contracts`](/agent-contracts/) and [`@adecore/agents-react`](/agents-react/).

## JSON entries

Six entries are JSON: the model catalogs `@adecore/agents/providers/<kind>-models.json` (`claude`, `codex`, `grok`, `copilot`, `antigravity`) and the bundled prices `@adecore/agents/usage/prices-snapshot.json`. Import them with `with { type: 'json' }` where the runtime asks for it. See [Providers](/agents/providers#models) and [Usage](/agents/usage#prices).

## `@adecore/agents`

Files, processes, watching, serialization and errors, shared by the other entries. See [Storage](/agents/storage).

<ExportTable entry="@adecore/agents" />

## `@adecore/agents/host`

Serving the requests over a port or a wire of your own. See [Host](/agents/host).

<ExportTable entry="@adecore/agents/host" />

## `@adecore/agents/chat`

The core, a session per chat, the thread and what is written of it, and the backends. See [Chats and turns](/agents/chats).

`spawnChatProcess` calls `onExit(code, signal)`, and `ChatChild` calls `onExit(code, stderr, signal)`. The signal is `null` when none ended the process, and a custom `SpawnChatProcess` may omit it. Use it to tell a crash from a deliberate stop such as `SIGTERM`.

<ExportTable entry="@adecore/agents/chat" />

## `@adecore/agents/providers`

The registry, the model catalogs, the runtime modes and the accounts of each CLI. See [Providers](/agents/providers) and [Accounts](/agents/accounts).

<ExportTable entry="@adecore/agents/providers" />

## `@adecore/agents/usage`

Transcripts, prices and plan limits. See [Usage](/agents/usage).

<ExportTable entry="@adecore/agents/usage" />

## `@adecore/agents/coordination`

The outbox, tasks between chats, lineage and messages. See [Coordination](/agents/coordination).

<ExportTable entry="@adecore/agents/coordination" />

## `@adecore/agents/context`

Tools an agent calls back into, their input schemas and refusals. See [Tools](/agents/tools).

<ExportTable entry="@adecore/agents/context" />

## `@adecore/agents/testing`

CLIs, a clock, a watcher and accounts for tests. See [Testing](/agents/testing).

Two more entries export nothing and run a fake as a process: start `@adecore/agents/testing/bin/fake-claude` or `@adecore/agents/testing/bin/fake-codex` with `bun` in place of the CLI. The captures the fakes follow are under `@adecore/agents/testing/fixtures/`.

<ExportTable entry="@adecore/agents/testing" />
