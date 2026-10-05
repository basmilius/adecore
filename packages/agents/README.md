# @adecore/agents

Agent chat hosting for Node and Bun, including an Electron utility process. Claude Code and Codex backends share a session/thread model, streamed events, persisted chats, provider accounts, usage, and durable coordination modules. A consumer supplies permissions, transport ownership, placement, context commands, and application lifecycle policy.

```ts
import { AgentHost } from '@adecore/agents/host/agent-host';
import { cliEnvironment } from '@adecore/agents/host/environment';
import type { FramePort } from '@adecore/agent-contracts';

export async function openHost(dataDir: string, port: FramePort) {
    const host = await AgentHost.open({ dataDir, env: cliEnvironment(process.env, { sessionPrefixes: ['APP'] }) });
    const disconnect = host.connect(port);
    return {
        host,
        async close(): Promise<void> {
            disconnect();
            await host.close();
        }
    };
}
```

A chat starts a CLI on its first prompt. Choose its runtime mode explicitly: the plain core defaults to `full-access`. Install/authenticate provider CLIs separately. For checks without real providers, inject `spawn` and `detect` and use the complete [fake-provider walkthrough](https://adecore.dev/agents/getting-started).

The [documentation](https://adecore.dev/agents/) covers [transport](https://adecore.dev/agents/transport), [host hooks](https://adecore.dev/agents/host-integration), [providers/models](https://adecore.dev/agents/providers-and-models), [turns/requests](https://adecore.dev/agents/turns-and-requests), [accounts/environment](https://adecore.dev/agents/accounts-and-environment), [outbox/tasks/messages](https://adecore.dev/agents/coordination), [context commands](https://adecore.dev/agents/context-commands), [persistence/helpers](https://adecore.dev/agents/persistence-and-helpers), [testing](https://adecore.dev/agents/testing-and-troubleshooting), [subpaths](https://adecore.dev/agents/entrypoints), and [migration](https://adecore.dev/agents/migration).

`wireAgents` supplies the same services and handlers for a host protocol of your own. `ChatCore` is extensible through admission, instructions, environment, prompt notes, folders, policy, persistence, and recovery hooks. A plain host refuses placement-dependent fork/continuation requests and installs no task/message context endpoint.

Import per module, `@adecore/agents/<path under src>` without an extension; there is no root export. Existing helper and coordination subpaths remain supported. [examples/agent-port](../../examples/agent-port) checks host, React transport/client, scope, and locale loading with fakes. Run its `test` script for source exports or `test:dist` after building for Node default exports.

Build `@adecore/agent-contracts` first, then run this package's `typecheck`, `test`, and `build` scripts. Default exports use compiled JavaScript/declarations; `source` selects TypeScript. No production source requires a Bun API.

This package is private at `0.0.0`, pending publication setup, and retains FSL-1.1-MIT. See [LICENSE](./LICENSE).
