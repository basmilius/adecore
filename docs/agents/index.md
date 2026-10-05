# @adecore/agents

A host for agent chats, for Node, Bun or an Electron utility process. It runs Claude Code and Codex as chat backends, keeps every thread on disk, streams it to the clients that read it, and manages the CLIs' accounts and what they cost. It answers the requests of [`@adecore/agent-contracts`](/agent-contracts/), so [`@adecore/agents-react`](/agents-react/) can draw it in a window.

```ts
import { AgentHost } from '@adecore/agents/host/agent-host';
```

## Install

::: code-group

```sh [bun]
bun add @adecore/agents @adecore/agent-contracts
```

```sh [npm]
npm install @adecore/agents @adecore/agent-contracts
```

```sh [pnpm]
pnpm add @adecore/agents @adecore/agent-contracts
```

:::

The package brings no CLI. Install Claude Code or Codex and sign in with it the way it asks; the host finds what is installed and asks each CLI who is signed in. It has no CSS and no words.

## What it does and what it leaves to you

The host starts a CLI on a chat's first message and keeps it running between turns. It turns what the CLI writes into the items of a thread, writes the thread to disk, replays what a reconnecting client missed, and answers approvals and questions. Around the chats it lists the CLIs and their models, keeps accounts in their own config folders, reads usage from the CLIs' transcripts and the plan limits from the CLIs.

It registers no IPC channel and opens no server: it serves a `FramePort` your app hands it, or hands you the request handlers to put behind a channel of your own. Who may connect, which folders a chat may work in and what an agent may do are yours to decide; [Host](/agents/host) shows where each check goes.

## Entry points

There is no root import. Every module has its own subpath, `@adecore/agents/<path>` without an extension, and the model catalogs are JSON: `@adecore/agents/providers/claude-models.json`. The [module reference](/agents/reference) lists every one. Keep them out of a page: the page imports the contracts and the views, never this package.

## Where to go next

- [Getting started](/agents/getting-started) runs a whole turn against a fake CLI, in one file.
- [Host](/agents/host) covers `AgentHost`, its options, the hooks of `ChatCore` and an Electron utility process.
- [Chats and turns](/agents/chats) covers sending, queuing, approvals, stopping and restarts.
- [Providers](/agents/providers) covers the CLIs, their model catalogs and the runtime modes.
- [Accounts and usage](/agents/accounts) covers config folders, secrets, the environment and usage.
- [Coordination](/agents/coordination) covers the outbox, tasks between chats and messages.
- [Context commands](/agents/context-commands) covers a command line your agents call back into.
- [Storage](/agents/storage) covers what is written where, and the file helpers.
- [Testing](/agents/testing) covers the fakes and the error codes.
