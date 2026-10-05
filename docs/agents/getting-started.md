# Getting started

Start with an injected provider process so the transport, persistence, and turn lifecycle can be checked without a login or network. Create `agent-client.ts` from the complete client adapter on the [transport page](./transport#typed-client-adapter), then put this file beside it as `example.ts`.

```ts
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentHost } from '@adecore/agents/host/agent-host';
import { ChatCore } from '@adecore/agents/chat/chat-core';
import { fakeClaude } from '@adecore/agents/chat/fake-claude';
import { inProcess } from '@adecore/agents/chat/fake-cli';
import { memoryPortPair } from '@adecore/agents/host/memory-port';
import { withTimeout } from '@adecore/agents/async';
import { createAgentClient } from './agent-client.js';

const dataDir = await mkdtemp(join(tmpdir(), 'adecore-doc-chat-'));
const fake = inProcess(fakeClaude);
const host = await AgentHost.open({
    dataDir,
    background: false,
    env: { HOME: dataDir, PATH: '' },
    command: ['fixture-cli'],
    spawn: fake.spawn,
    detect: async () => ({ installed: true, version: 'fixture' }),
    core: (options) => new ChatCore({ ...options, nameChat: undefined })
});
const [clientPort, hostPort] = memoryPortPair();
const disconnect = host.connect(hostPort);
const client = createAgentClient(clientPort);
const turn = new Promise<void>((resolve) => {
    const release = client.on('chat.event', ({ event }) => {
        if (event.type === 'item' && event.item.kind === 'turn' && event.item.state === 'done') {
            release();
            resolve();
        }
    });
});

try {
    await client.request('chat.create', { chatId: 'example', provider: 'claude', cwd: dataDir, runtimeMode: 'supervised' });
    await client.request('chat.attach', { chatId: 'example' });
    const sent = await client.request('chat.send', { chatId: 'example', text: 'hello' });
    assert.equal(sent.queued, false);
    await withTimeout(turn, 5000, 'The fake turn did not finish');
    const snapshot = await client.request('chat.attach', { chatId: 'example' });
    assert.ok(snapshot.items.some((item) => item.kind === 'assistant' && item.text === 'echo: hello'));
    await client.request('chat.detach', { chatId: 'example' });
} finally {
    client.close();
    disconnect();
    await host.close();
    await rm(dataDir, { recursive: true, force: true });
}
```

The fake simulates provider frames in process. Detection is injected, `background: false` prevents scheduled account/limit probes, and the custom core disables one-shot title generation. All state is confined to a new temporary folder. The cleanup removes that fixture folder only.

`chat.create` loads or creates a session; the CLI starts on the first prompt. Attach before sending if you want to receive its thread events. A send reply confirms admission or queuing, not turn completion. Wait for the matching turn event when the caller needs a final answer. The example has one turn; an application should also match chat and turn ids.

## Run locally

These packages are private workspace packages, not a published `0.0.0` npm installation. After the repository's workspace install:

```sh
bun run --cwd packages/agent-contracts build
bun run --cwd packages/agents build
bun --conditions=source example.ts
```

For compiled Node use, transpile your ESM example and use the default package exports. Compiled relative imports use `.js`; JSON catalogs and fake CLI assets are included in `dist`. Packed execution is checked on Node 22 and 24.

The existing [agent port example](https://github.com/basmilius/adecore/tree/main/examples/agent-port) also exercises `ChatClient`, `portTransport`, a React scope, and locale loading. Its `test` script selects source exports; `test:dist` uses built exports under Node. Backend setup needs no CSS or i18n. Follow [agent views](../agents-react/) when adding a rendered chat.

## Enable an installed provider

Supply a real environment filtered by [host policy](./accounts-and-environment#environment-policy), an authorized data directory, and a working directory. Omit fake `spawn`/`detect`/command overrides. Choose a runtime mode explicitly. `AgentHost.open` loads account settings and starts scheduled probes unless `background` is false. Installing and authenticating the CLI is a host/user prerequisite, not an operation this package performs automatically.
