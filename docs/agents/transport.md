# Transport

`AgentHost.connect(port)` treats one `FramePort` as one client and returns an idempotent disconnect function. The host sends global status/account/limit events and streams a chat's conversation after attachment. Disconnect releases subscriptions, chat/subagent attachments, usage follows, and connection-scoped composer preferences. It does not stop the chat.

`FramePort` carries `unknown` at receipt because validation belongs at the receiving end. `AgentHost` validates request envelopes, known names, and payloads. It sends structured errors for malformed requests. It does not authenticate the port, validate outgoing results, add a timeout, or reopen a dropped connection.

## Typed client adapter

The following is a complete consumer-owned adapter. Save it as `agent-client.ts`. It uses only browser-safe contracts and Zod types, validates correlated results/events, rejects pending requests on close, and applies a request deadline. An application can instead use the official [`portTransport`](../agents-react/) with the React client.

```ts
import {
    AGENT_REQUEST_SCHEMAS,
    AGENT_EVENT_SCHEMAS,
    parseServerFrame,
    type AgentRequestType,
    type AgentEventType,
    type Event,
    type FramePort,
    type Reply
} from '@adecore/agent-contracts';
import type { z } from 'zod';

type Payload<Name extends AgentRequestType> = z.output<(typeof AGENT_REQUEST_SCHEMAS)[Name]['payload']>;
type Result<Name extends AgentRequestType> = z.output<(typeof AGENT_REQUEST_SCHEMAS)[Name]['result']>;
type EventPayload<Name extends AgentEventType> = z.output<(typeof AGENT_EVENT_SCHEMAS)[Name]>;

export function createAgentClient(port: FramePort, timeoutMs = 10000) {
    let nextId = 0;
    let closed = false;
    const pending = new Map<string, { accept(reply: Reply): void; reject(error: Error): void }>();
    const listeners = new Set<(frame: Event) => void>();
    const release = port.onFrame((input) => {
        const parsed = parseServerFrame(input);
        if (!parsed.ok) {
            return;
        }
        const frame = parsed.value;
        if ('type' in frame) {
            for (const listener of listeners) {
                listener(frame);
            }
        } else if (frame.id !== null) {
            pending.get(frame.id)?.accept(frame);
        }
    });

    return {
        async request<Name extends AgentRequestType>(name: Name, payload: Payload<Name>): Promise<Result<Name>> {
            if (closed) {
                throw new Error('The client is closed');
            }
            const checked = AGENT_REQUEST_SCHEMAS[name].payload.parse(payload);
            const id = `request-${++nextId}`;
            return new Promise<Result<Name>>((resolve, reject) => {
                const finish = (): void => {
                    clearTimeout(timer);
                    pending.delete(id);
                };
                const fail = (error: Error): void => {
                    finish();
                    reject(error);
                };
                const timer = setTimeout(() => fail(new Error(`Request ${name} timed out`)), timeoutMs);
                pending.set(id, {
                    reject: fail,
                    accept: (reply) => {
                        finish();
                        if (!reply.ok) {
                            reject(Object.assign(new Error(reply.error.message), { code: reply.error.code }));
                            return;
                        }
                        const result = AGENT_REQUEST_SCHEMAS[name].result.safeParse(reply.result);
                        if (!result.success) {
                            reject(new Error(`Invalid result for ${name}`));
                            return;
                        }
                        resolve(result.data as Result<Name>);
                    }
                });
                try {
                    port.send({ id, type: name, payload: checked });
                } catch (error) {
                    fail(error instanceof Error ? error : new Error(String(error)));
                }
            });
        },
        on<Name extends AgentEventType>(name: Name, listener: (payload: EventPayload<Name>) => void): () => void {
            const receive = (frame: Event): void => {
                if (frame.event === name) {
                    const payload = AGENT_EVENT_SCHEMAS[name].safeParse(frame.payload);
                    if (payload.success) {
                        listener(payload.data as EventPayload<Name>);
                    }
                }
            };
            listeners.add(receive);
            return () => {
                listeners.delete(receive);
            };
        },
        close(): void {
            if (closed) {
                return;
            }
            closed = true;
            release();
            listeners.clear();
            for (const request of pending.values()) {
                request.reject(new Error('The client closed before the request finished'));
            }
        }
    };
}
```

A timeout rejects the client's promise; it does not cancel the server operation. An error with a null correlation id cannot settle an individual request. This adapter ignores invalid envelopes/events and lets unmatched requests expire. Add diagnostics for those cases in a production transport. Event listeners run synchronously, so handle listener failures inside your application.

## Browser message port adapter

After your host authorizes and transfers a DOM `MessagePort`, wrap it without importing any backend module:

```ts
import type { FramePort } from '@adecore/agent-contracts/port';

export function asFramePort(port: MessagePort): FramePort {
    return {
        send: (frame) => port.postMessage(frame),
        onFrame: (listener) => {
            const receive = (event: MessageEvent<unknown>): void => listener(event.data);
            port.addEventListener('message', receive);
            port.start();
            return () => port.removeEventListener('message', receive);
        }
    };
}
```

The release removes this listener only. The owner closes the physical port after releasing both host/client adapters. Electron's `MessagePortMain` uses `on('message')`/`off('message')` with `{ data }` events and `start()`; keep that adapter in the main or utility process. Register and guard your application's transfer channel there. The library creates none.

## Custom host protocols

When agent requests share a wire with application operations, use `wireAgents`. Validate the envelope and selected payload, verify the sender and operation authorization, then invoke `wiring.handlers[type](payload, clientId)`. Keep one stable client id for that connection. Forward `wiring.connect(clientId, send)` events and release it on disconnect. A plain handler call has no automatic validation or permission guard.

`ClientSinks<TEvent>` is the reusable event fanout. A subscription with the same client id replaces the previous sink; releasing an old subscription does not remove its replacement. `emit` reaches all sinks and `to` reaches one. Send failures/listener exceptions are the consumer's responsibility.
