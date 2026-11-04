# Getting started

This page installs the host, runs a whole turn against a fake CLI in one file, and then connects the host to a window. The window side is [Getting started with the views](/agents-react/getting-started).

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

The package brings no CLI, CSS or words. To run real chats, install Claude Code or Codex and sign in; the host finds what is installed and asks each CLI who is signed in. Import the package only in the process that runs the chats, never in a page.

## A first turn

This file runs a host and sends it a message without a real CLI. `fakeClaude` speaks Claude Code's protocol in the same process and answers every message with `echo:` and the text. Everything goes to a temporary folder that the script removes at the end.

```ts
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChatEventEnvelope, ServerFrame } from '@adecore/agent-contracts';
import { ChatCore } from '@adecore/agents/chat';
import { fakeClaude, inProcess } from '@adecore/agents/testing';
import { AgentHost, memoryPortPair } from '@adecore/agents/host';

const dataDir = await mkdtemp(join(tmpdir(), 'agents-example-'));
const fake = inProcess(fakeClaude);
const host = await AgentHost.open({
    dataDir,
    background: false,
    env: { HOME: dataDir, PATH: '' },
    command: ['fake-claude'],
    spawn: fake.spawn,
    detect: async () => ({ installed: true, version: 'fake' }),
    core: (options) => new ChatCore({ ...options, nameChat: undefined })
});

const [client, server] = memoryPortPair();
const disconnect = host.connect(server);

const answers = new Map<string, (frame: ServerFrame) => void>();
const events: ChatEventEnvelope[] = [];
client.onFrame((frame) => {
    const reply = frame as ServerFrame;
    if ('event' in reply) {
        if (reply.event === 'chat.event') {
            events.push(reply.payload as ChatEventEnvelope);
        }
    } else if (reply.id !== null) {
        answers.get(reply.id)?.(reply);
    }
});

let nextId = 0;
const request = (type: string, payload: unknown): Promise<any> =>
    new Promise((resolve, reject) => {
        const id = String(++nextId);
        answers.set(id, (reply) => ('result' in reply ? resolve(reply.result) : reject(new Error('error' in reply ? reply.error.message : type))));
        client.send({ id, type, payload });
    });

const turnDone = (): boolean => events.some(({ event }) => event.type === 'item' && event.item.kind === 'turn' && event.item.state === 'done');

try {
    await request('chat.create', { chatId: 'first', provider: 'claude', cwd: dataDir, runtimeMode: 'supervised' });
    await request('chat.attach', { chatId: 'first' });
    await request('chat.send', { chatId: 'first', text: 'hello' });

    while (!turnDone()) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const { items } = await request('chat.attach', { chatId: 'first' });
    console.log(items.filter((item: { kind: string }) => item.kind === 'assistant'));
} finally {
    disconnect();
    await host.close();
    await rm(dataDir, { recursive: true, force: true });
}
```

Run it with `bun example.ts`. It prints the reply item with the text `echo: hello`.

- `spawn` and `command` start the fake instead of a CLI, and `detect` reports it installed.
- `env` is the whole environment the CLI gets. Without it the host passes its own, filtered (see [Accounts](/agents/accounts#the-environment)).
- `background: false` stops the timed checks of accounts and plan limits.
- The custom `core` turns off chat naming, which sends the CLI a question of its own.
- `runtimeMode: 'supervised'` asks before every tool call. A new chat defaults to `full-access`.

The CLI starts on the first message, not on `chat.create`. Attach before you send to get the thread's events. The reply to `chat.send` means the message was taken or queued. Wait for the turn item to know the turn is done.

## A real CLI

Leave out `spawn`, `command` and `detect`, and the host starts the CLI it finds on the environment's `PATH`. Pick the runtime mode yourself, and give the host a `dataDir` of its own.

## Connect a window

A window reaches the host over a [`FramePort`](/agent-contracts/protocol#frameport). In Electron, the host runs in a utility process, and the main process hands it one end of a `MessageChannelMain` per window:

```ts
// agents.ts, started with utilityProcess.fork
import type { FramePort } from '@adecore/agent-contracts';
import { AgentHost } from '@adecore/agents/host';

const host = await AgentHost.open({ dataDir: process.argv[2]! });

process.parentPort.on('message', ({ ports }) => {
    const port = ports[0];

    if (port === undefined) {
        return;
    }

    const frames: FramePort = {
        send: (frame) => port.postMessage(frame),
        onFrame: (listener) => {
            const receive = ({ data }: { data: unknown }): void => listener(data);
            port.on('message', receive);
            port.start();

            return () => port.off('message', receive);
        }
    };

    const disconnect = host.connect(frames);
    port.on('close', disconnect);
});
```

```ts
// main.ts
import { MessageChannelMain, utilityProcess, type BrowserWindow } from 'electron';

const agents = utilityProcess.fork(join(__dirname, 'agents.js'), [join(app.getPath('userData'), 'agents')]);

function connectAgents(window: BrowserWindow): void {
    const { port1, port2 } = new MessageChannelMain();
    agents.postMessage(null, [port1]);
    window.webContents.postMessage('agents:port', null, [port2]);
}
```

The preload passes the port on to the page, which wraps it as in the [views' getting started](/agents-react/getting-started#a-scope). The channel name `agents:port` is the app's own; the package registers none. Check which window and frame asked before you hand it a port, since the port has no authentication. [Host](/agents/host#electron) covers quitting.

## Checklist

- The host has a data folder of its own, and no other process writes there.
- Only the process that runs the chats imports `@adecore/agents`.
- The app checks who asks before it hands the host a port.
- A client attaches to a chat before it sends, so it gets the thread's events.
- On quit, the app waits for `host.close()` before the process exits.
