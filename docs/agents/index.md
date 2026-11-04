# Agents

`@adecore/agents` is a host for agent chats, for Node, Bun or an Electron utility process. It runs Claude Code, Codex and other agent CLIs as chat backends, keeps every thread on disk, and streams it to the clients that read it. It also manages the CLIs' accounts and reads what they cost. It answers the requests of [`@adecore/agent-contracts`](/agent-contracts/), so [`@adecore/agents-react`](/agents-react/) can draw it in a window.

```ts
import { AgentHost } from '@adecore/agents/host';
```

## What it does

- Starts a CLI on a chat's first message, keeps it running between turns, and turns its output into thread items.
- Writes every thread to disk and replays what a reconnecting client missed.
- Answers approvals and questions, queues and steers messages, and stops, clears and restarts chats.
- Lists the CLIs and their models, and maps a chat's runtime mode onto each CLI's own permission settings.
- Keeps accounts in their own config folders, with secrets in the macOS keychain.
- Reads usage from the CLIs' transcripts and the plan limits from the CLIs themselves.
- Offers building blocks for agents that hand each other work: an outbox, tasks, lineage, messages and tools.

## What it leaves to the app

The host registers no IPC channel and opens no server. It serves a `FramePort` the app hands it, or gives the app the request handlers to put behind its own channel. The app decides who may connect, which folders a chat may work in and what an agent may do; [Host](/agents/host) shows where each check goes. The package brings no CLI, CSS or words, and never runs in a page: a window imports the contracts and the views.

## Where to next

- [Getting started](/agents/getting-started) installs the package, runs a whole turn against a fake CLI and connects a window.
- [Host](/agents/host) covers `AgentHost`, its options, the hooks of `ChatCore` and an Electron utility process.
- [Chats and turns](/agents/chats) covers sending, queuing, approvals, stopping and restarts.
- [Providers](/agents/providers) covers the CLIs, their model catalogs and the runtime modes.
- [ACP agents](/agents/acp) covers agents on the Agent Client Protocol.
- [Accounts](/agents/accounts) covers config folders, secrets and the environment a CLI starts in.
- [Usage](/agents/usage) covers summaries, prices and plan limits.
- [Coordination](/agents/coordination) covers the outbox, tasks between chats, lineage and messages.
- [Tools](/agents/tools) covers the tools your agents call back into.
- [Storage](/agents/storage) covers what is written where, and the file helpers.
- [Testing](/agents/testing) covers the fake CLIs, clock and watcher.
- [Error codes](/agents/errors) lists the codes a refusal carries.
- [Reference](/agents/reference) lists every export of every entry point.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/agents/LICENSE).
