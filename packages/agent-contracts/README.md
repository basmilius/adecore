# @adecore/agent-contracts

Zod schemas and TypeScript contracts shared by agent chat hosts and clients. The package covers conversations, attachments, approvals, providers, model selections, accounts, tasks, worktrees, and usage. It is browser safe and contains no process or transport implementation.

```ts
import { AGENT_REQUEST_SCHEMAS, parseRequest } from '@adecore/agent-contracts';
import type { FramePort } from '@adecore/agent-contracts/port';

const payload = AGENT_REQUEST_SCHEMAS['chat.send'].payload.parse({ chatId: 'chat-1', text: 'Hello' });
```

Envelope parsing checks frame structure. Persisted and wire discriminants, including the historical host-owned subagent origin, remain unchanged during the package migration. Validate payloads and correlated results against the selected table schema too. A consumer supplies transport ownership, authorization, and any larger host protocol.

The [documentation](https://adecore.dev/agent-contracts/) covers [setup](https://adecore.dev/agent-contracts/getting-started), [frames and replay](https://adecore.dev/agent-contracts/frames-and-events), [conversation content](https://adecore.dev/agent-contracts/conversation), [providers/accounts](https://adecore.dev/agent-contracts/providers-and-accounts), [tasks/usage](https://adecore.dev/agent-contracts/tasks-and-usage), and [entrypoints/compatibility](https://adecore.dev/agent-contracts/validation-and-compatibility).

The root reexports all groups. Supported subpaths are `agent`, `chat`, `envelope`, `ids`, `model`, `port`, `protocol`, `provider-accounts`, `task`, `text`, `usage`, and `worktree`.

This package is private at `0.0.0`, pending publication setup. In the local workspace, build it with `bun run --cwd packages/agent-contracts build`, then run its `typecheck` and `test` scripts. Default exports use compiled JavaScript/declarations; the `source` condition uses TypeScript. Build it before the backend and React packages.

Transferred code retains FSL-1.1-MIT. See [LICENSE](./LICENSE).
