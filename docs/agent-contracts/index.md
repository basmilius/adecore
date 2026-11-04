# Agent contracts

`@adecore/agent-contracts` holds the Zod schemas and TypeScript types that a host of agent chats and its clients share. It describes the frames on the wire, every request and event, a chat and its thread, the CLIs and their models, accounts, tasks, worktrees and usage. Both sides import it, so a window and a backend agree on every shape without sharing code beyond this package.

```ts
import { AGENT_REQUEST_SCHEMAS, parseRequest } from '@adecore/agent-contracts';
```

## What it does

- Parses the frames of the wire with `parseRequest` and `parseServerFrame`, which never throw.
- Maps every request name to a payload and a result schema, and every event name to its payload schema.
- Describes a chat as a `ChatInfo` and a thread of items, with attachments, approvals, questions, bookmarks and checkpoints.
- Describes the CLIs a host runs, their model catalogs, capabilities and permission modes, and the accounts they sign in with.
- Holds the helpers both sides need to read the same shapes the same way, such as `appendToolOutput`, `outlineItems` and `evenPace`.
- Defines the bridge between an agent's published page and the app, with its theme and bootstrap.

## What it leaves to the app

The package opens no connection, starts no process and makes no permission decision. The app wraps its own channel as a `FramePort`, decides who may connect, and checks who asks before a request reaches a host. A host such as [`@adecore/agents`](/agents/) answers the requests, and [`@adecore/agents-react`](/agents-react/) draws a chat from them. Either side can be your own.

## Where to next

- [Getting started](/agent-contracts/getting-started) checks a message with a schema and connects a client and a host over a port.
- [Protocol](/agent-contracts/protocol) covers the frames, the port, replay after a reconnect, and adding requests of your own.
- [Requests and events](/agent-contracts/requests) lists every request and event with its schemas.
- [Conversation](/agent-contracts/conversation) covers a chat's info and items, attachments, approvals and questions, bookmarks and checkpoints.
- [UI blocks in replies](/agent-contracts/ui-replies) covers the blocks of components an assistant item carries, and the requests that act on them.
- [Visuals](/agent-contracts/visuals) covers pages an agent publishes in a chat, the bridge between a page and the app, and its theme.
- [Providers and models](/agent-contracts/providers) covers agent kinds, model catalogs, capabilities, runtime modes and terminal agents.
- [Accounts](/agent-contracts/accounts) covers the config folders a CLI signs in with, their order and their status.
- [Tasks and worktrees](/agent-contracts/tasks) covers tasks between chats and the git worktrees they work in.
- [Usage](/agent-contracts/usage) covers token totals, usage summaries and plan limits.
- [Reference](/agent-contracts/reference) lists every export of every entry point.

The package is licensed under [FSL-1.1-MIT](https://github.com/basmilius/adecore/blob/main/packages/agent-contracts/LICENSE).
