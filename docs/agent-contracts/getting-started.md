# Getting started

This page installs the contracts, checks a message with a schema, and connects a client and a host over a port. With [`@adecore/agents`](/agents/) on the host side and [`@adecore/agents-react`](/agents-react/) in the window, you write neither end of the port. The last sections show what they do, for an app that writes one end itself.

## Install

::: code-group

```sh [bun]
bun add @adecore/agent-contracts
```

```sh [npm]
npm install @adecore/agent-contracts
```

```sh [pnpm]
pnpm add @adecore/agent-contracts
```

:::

Zod 4 comes along as a dependency. There is no CSS and no words to load, and the package runs in a browser, a preload, Node and Bun.

## Check a message

A schema parses what crosses a boundary and throws on what does not fit. The inferred types describe the parsed output.

```ts
import { AGENT_REQUEST_SCHEMAS, ChatAttachmentUploadSchema } from '@adecore/agent-contracts';
import type { ChatSendPayload } from '@adecore/agent-contracts/chat';

const message: ChatSendPayload = {
    chatId: 'chat-1',
    text: 'Read the attached note.',
    attachments: [ChatAttachmentUploadSchema.parse({ name: 'note.txt', mime: 'text/plain', data: 'SGVsbG8=' })]
};

const payload = AGENT_REQUEST_SCHEMAS['chat.send'].payload.parse(message);
const result = AGENT_REQUEST_SCHEMAS['chat.send'].result.parse({ queued: false });
```

`.parse()` throws a `ZodError`. `.safeParse()` returns `{ success, data }` or `{ success, error }`. A parse strips unknown keys. Few fields have a default, so an omitted optional field stays absent and the reader decides what that means. The guides say so where it matters, such as an account without `enabled`, which is on.

`AGENT_REQUEST_SCHEMAS` holds a `payload` and a `result` schema per request, and `AGENT_EVENT_SCHEMAS` one schema per event. [Requests and events](/agent-contracts/requests) lists them all.

## Implement a port

A `FramePort` is the connection between a client and a host. It sends a frame and hands every frame that arrives to a listener:

```ts
interface FramePort {
    send(frame: Request | ServerFrame): void;
    onFrame(listener: (frame: unknown) => void): () => void;
}
```

A `MessagePort` of the DOM fits in a few lines. Both ends of a `MessageChannel` wrap the same way:

```ts
import type { FramePort } from '@adecore/agent-contracts';

export function framePortOf(port: MessagePort): FramePort {
    return {
        send: (frame) => port.postMessage(frame),
        onFrame: (listener) => {
            const receive = (event: MessageEvent): void => listener(event.data);
            port.addEventListener('message', receive);
            port.start();

            return () => port.removeEventListener('message', receive);
        }
    };
}
```

A port that clones its messages passes frames as they are. Over a socket, send `JSON.stringify(frame)` and hand the listener the parsed text. Electron's `MessagePortMain` in the main or a utility process calls its listener with `{ data }` through `port.on('message', ...)`, so read `data` there. The port knows nothing of connecting, closing or timeouts; the code that makes it decides that.

## The client side

A client sends a request with an id of its own and waits for the reply with that id. It checks the frame with `parseServerFrame` and the result with the request's schema:

```ts
import { AGENT_EVENT_SCHEMAS, AGENT_REQUEST_SCHEMAS, parseServerFrame, type AgentRequestType, type FramePort } from '@adecore/agent-contracts';

type Result<T extends AgentRequestType> = ReturnType<(typeof AGENT_REQUEST_SCHEMAS)[T]['result']['parse']>;

export function connect(port: FramePort) {
    const waiting = new Map<string, { type: AgentRequestType; resolve: (result: unknown) => void; reject: (error: Error) => void }>();
    let nextId = 0;

    port.onFrame((input) => {
        const frame = parseServerFrame(input);

        if (!frame.ok) {
            return;
        }

        if ('event' in frame.value) {
            if (frame.value.event === 'chat.status') {
                const { chatId, info } = AGENT_EVENT_SCHEMAS['chat.status'].parse(frame.value.payload);
                console.log(chatId, info.status);
            }

            return;
        }

        const entry = frame.value.id === null ? undefined : waiting.get(frame.value.id);

        if (entry === undefined || frame.value.id === null) {
            return;
        }

        waiting.delete(frame.value.id);

        if (frame.value.ok) {
            entry.resolve(AGENT_REQUEST_SCHEMAS[entry.type].result.parse(frame.value.result));
        } else {
            entry.reject(new Error(`${frame.value.error.code}: ${frame.value.error.message}`));
        }
    });

    return <T extends AgentRequestType>(type: T, payload: unknown): Promise<Result<T>> =>
        new Promise((resolve, reject) => {
            const id = String(++nextId);
            waiting.set(id, { type, resolve: resolve as (result: unknown) => void, reject });
            port.send({ id, type, payload: AGENT_REQUEST_SCHEMAS[type].payload.parse(payload) });
        });
}

const request = connect(framePortOf(channel.port1));
const { chats } = await request('chat.list', {});
```

`channel` is a `MessageChannel`. In an app the two ends usually live in two processes: the window keeps one, and the process that runs the chats gets the other.

`portTransport` of `@adecore/agents-react` is this client, with a status, event subscriptions and typed payloads. See [Getting started with the views](/agents-react/getting-started#a-scope).

## The host side

A host reads a request with `parseRequest`, looks up its schemas, checks the payload and answers with the same id. A failure carries a code the client can branch on:

```ts
import { AGENT_REQUEST_SCHEMAS, parseRequest, type AgentRequestType, type FramePort } from '@adecore/agent-contracts';

export function serve(port: FramePort): () => void {
    return port.onFrame((input) => {
        const frame = parseRequest(input);

        if (!frame.ok) {
            port.send({ id: null, ok: false, error: { code: 'bad-request', message: frame.message } });

            return;
        }

        const { id, type, payload } = frame.value;

        if (!(type in AGENT_REQUEST_SCHEMAS)) {
            port.send({ id, ok: false, error: { code: 'unknown-request', message: `No request ${type}.` } });

            return;
        }

        const parsed = AGENT_REQUEST_SCHEMAS[type as AgentRequestType].payload.safeParse(payload);

        if (!parsed.success) {
            port.send({ id, ok: false, error: { code: 'bad-request', message: parsed.error.message } });

            return;
        }

        if (type === 'chat.list') {
            port.send({ id, ok: true, result: { chats: [] } });
        } else {
            port.send({ id, ok: false, error: { code: 'chat-unsupported', message: `${type} is not served here.` } });
        }
    });
}

serve(framePortOf(channel.port2));
```

`AgentHost.connect(port)` of `@adecore/agents` is this host, with every request answered. See [Getting started with the host](/agents/getting-started).

## Checklist

- Both ends wrap their port as a `FramePort`, and the receiver checks every frame it gets.
- The host answers every request with its id, also when it fails.
- A failure carries a code, and the client branches on the code, not on the message.
- The app decides who may connect before it hands either end a port. The contracts have no authentication.
