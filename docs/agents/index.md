# Agent hosts

`@adecore/agents` runs agent chats in Node and Bun, including an Electron utility process. It supplies Claude Code and Codex backends, provider/account services, chat storage, streamed events, usage, and durable coordination modules. [Agent contracts](../agent-contracts/) defines the shared schemas; [agent views](../agents-react/) is the browser/React client.

A consumer owns caller authorization, session and filesystem access, placement, context commands, task wording, and notification delivery. The package registers no application IPC channels or servers. `AgentHost` answers agent frames over a supplied `FramePort`; `wireAgents` supplies the same services and handlers for a larger host protocol.

## Read the guide

| Chapter                                                      | What it covers                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| [Getting started](./getting-started)                         | A complete fake-provider turn and local setup                                    |
| [Transport](./transport)                                     | A typed request client, message port adapter, validation, and disconnect         |
| [Host integration](./host-integration)                       | `AgentHost`, `wireAgents`, `ChatCore` hooks, and consumer responsibilities       |
| [Providers and models](./providers-and-models)               | Registry, catalogs, backend seams, prerequisites, and runtime modes              |
| [Turns and requests](./turns-and-requests)                   | Queue, streaming, approval/question lifetime, cancellation, and restart          |
| [Accounts and environment](./accounts-and-environment)       | Config homes, secret storage, policy filtering, and usage                        |
| [Durable coordination](./coordination)                       | Outbox, tasks, lineage, descendant shutdown, and messages                        |
| [Context commands](./context-commands)                       | Argument schemas, help, revision checks, dry runs, and refusals                  |
| [Persistence and helpers](./persistence-and-helpers)         | File layouts, replay logs, atomic writes, serialization, watchers, and processes |
| [Testing and troubleshooting](./testing-and-troubleshooting) | Deterministic fakes, error codes, and diagnostic checks                          |
| [Public entrypoints](./entrypoints)                          | Supported backend subpaths and assets                                            |
| [Migration](./migration)                                     | Import changes, preserved formats, adapters, and consumer validation             |

## Package status

Import modules by subpath, for example `@adecore/agents/host/agent-host`. The package has no root export. Source conditions select TypeScript; default exports select compiled JavaScript and declarations. Build contracts first.

This package is private at `0.0.0` until first publication and Trusted Publishing setup. Its transferred code retains FSL-1.1-MIT; see the [license](https://github.com/basmilius/adecore/blob/main/packages/agents/LICENSE). No provider executable is bundled or installed by the library.
