# @adecore/agent-contracts

[![npm](https://img.shields.io/npm/v/@adecore/agent-contracts)](https://www.npmjs.com/package/@adecore/agent-contracts)
[![Docs](https://img.shields.io/badge/docs-adecore.dev-blue)](https://adecore.dev/agent-contracts/)

The Zod schemas and TypeScript types an agent chat host and its clients share: the frames on the wire, the requests and events, a chat and its items, providers, models, accounts, tasks, worktrees and usage. It opens no connection and starts no process, so a browser, a preload and a backend can all import it.

## Install

```sh
bun add @adecore/agent-contracts
```

## Use

```ts
import { AGENT_REQUEST_SCHEMAS, parseRequest } from '@adecore/agent-contracts';

const frame = parseRequest(incoming);
if (frame.ok && frame.value.type === 'chat.send') {
    const payload = AGENT_REQUEST_SCHEMAS['chat.send'].payload.parse(frame.value.payload);
}
```

The root exports everything. Each group also has a subpath of its own: `agent`, `chat`, `envelope`, `ids`, `model`, `port`, `protocol`, `provider-accounts`, `task`, `text`, `usage` and `worktree`.

## Documentation

| Page | What it covers |
|---|---|
| [Overview](https://adecore.dev/agent-contracts/) | Install, a first check and the entry points |
| [Protocol](https://adecore.dev/agent-contracts/protocol) | Frames, the request and event tables, replay and adding requests |
| [Conversation](https://adecore.dev/agent-contracts/conversation) | A chat's info and items, attachments, approvals, bookmarks and forks |
| [Providers and models](https://adecore.dev/agent-contracts/providers) | Agent kinds, model catalogs, capabilities and runtime modes |
| [Accounts](https://adecore.dev/agent-contracts/accounts) | Provider accounts and sign-ins |
| [Tasks and worktrees](https://adecore.dev/agent-contracts/tasks) | Tasks and worktrees |
| [Usage](https://adecore.dev/agent-contracts/usage) | Token totals, summaries and plan limits |

## License

FSL-1.1-MIT. See [LICENSE](./LICENSE).
