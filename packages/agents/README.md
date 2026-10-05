# @adecore/agents

[![npm](https://img.shields.io/npm/v/@adecore/agents)](https://www.npmjs.com/package/@adecore/agents)
[![Docs](https://img.shields.io/badge/docs-adecore.dev-blue)](https://adecore.dev/agents/)

A host for agent chats in Node, Bun or an Electron utility process. It runs Claude Code and Codex as chat backends, keeps every thread on disk, streams it to its clients, and manages the CLIs' accounts and usage. It answers the requests of [`@adecore/agent-contracts`](https://adecore.dev/agent-contracts/) over a port you hand it, and registers no channel of its own.

## Install

```sh
bun add @adecore/agents @adecore/agent-contracts
```

The package brings no CLI: install Claude Code or Codex and sign in with it.

## Use

```ts
import { AgentHost } from '@adecore/agents/host/agent-host';

const host = await AgentHost.open({ dataDir });
const disconnect = host.connect(port);

// later
disconnect();
await host.close();
```

Every module has its own subpath, `@adecore/agents/<path>`; there is no root import. A new chat runs in `full-access` unless it names a runtime mode, so name one.

## Documentation

| Page | What it covers |
|---|---|
| [Getting started](https://adecore.dev/agents/getting-started) | A whole turn against a fake CLI, in one file |
| [Host](https://adecore.dev/agents/host) | `AgentHost`, its options, `wireAgents`, the hooks of `ChatCore` and Electron |
| [Chats and turns](https://adecore.dev/agents/chats) | Sending, queuing, approvals, stopping and restarts |
| [Providers](https://adecore.dev/agents/providers) | The CLIs, their model catalogs and the runtime modes |
| [Accounts and usage](https://adecore.dev/agents/accounts) | Config folders, secrets, the environment and usage |
| [Coordination](https://adecore.dev/agents/coordination) | The outbox, tasks between chats, lineage and messages |
| [Context commands](https://adecore.dev/agents/context-commands) | A command line your agents call back into |
| [Storage](https://adecore.dev/agents/storage) | What is written where, and the file helpers |
| [Testing](https://adecore.dev/agents/testing) | The fakes and the error codes |
| [Modules](https://adecore.dev/agents/reference) | Every subpath of the package |

## License

FSL-1.1-MIT. See [LICENSE](./LICENSE).
