# Chat state and lifecycle

Create one `ChatClient` per backend connection. It writes through a `ChatSink` and subscribes to chat events, status events, bookmarks, and connection status. Supplying `providerSinkFor(scopeId)` also fills the provider catalog. Keep the client and transport stable across renders.

## Open, attach, and reconnect

`open(chatId, options)` remembers a mounted chat, sends `chat.create`, then `chat.attach` with a 60-item history limit. The backend keeps the configuration of an existing chat. Options for a new chat include `provider`, `account`, `cwd`, `resume`, `selection`, and `runtimeMode`.

A connection refusal (`not-connected` or `disconnected`) makes `open` return `false`; the mounted chat remains registered and attaches when the same transport reports `open`. Other failures reject. A reconnect sends remembered preferences again, reloads providers and statuses, and reattaches mounted chats with their last sequence. The backend may return replay events or a fresh snapshot. Do not replace a reconnecting transport object underneath the client.

`detach(chatId)` removes the mount and asks the backend to stop streaming it. It does not stop the agent. `dispose()` releases event subscriptions and starts detaching all mounts; it is synchronous and does not await those requests. Close the transport when the connection owner is done. Use `kill()` only for an intentional deletion; it forgets local state before requesting the backend kill.

## Render a thread and composer

The component below receives a stable scope from [setup](./getting-started), after storage and translations are ready. It handles open and send failures without an unhandled promise. The failed payload stays available for retry because `Composer.onSend` is a void callback and clears its draft immediately.

```tsx
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@adecore/ui';
import type { ChatSendExtras } from '@adecore/agents-react/chat/chat-client';
import { Composer } from '@adecore/agents-react/chat/ui/Composer';
import { Timeline } from '@adecore/agents-react/chat/ui/Timeline';
import { ChatScopeContext, useChatScope, type ChatScope } from '@adecore/agents-react/scope';
import { useChatRow } from '@adecore/agents-react/state/chats';

type FailedSend = { text: string; extras: ChatSendExtras };

function Thread({ chatId, cwd }: { chatId: string; cwd: string }) {
    const scope = useChatScope();
    const info = useChatRow(chatId, (row) => row?.info);
    const [error, setError] = useState<string | null>(null);
    const [failed, setFailed] = useState<FailedSend | null>(null);
    const connected = useSyncExternalStore(
        useCallback((changed: () => void) => scope.transport.subscribeStatus(changed), [scope]),
        () => scope.transport.status === 'open',
        () => false
    );
    useEffect(() => {
        let mounted = true;
        void scope.chats.open(chatId, { cwd }).catch((cause: unknown) => {
            if (mounted) {
                setError(cause instanceof Error ? cause.message : String(cause));
            }
        });
        return () => {
            mounted = false;
            void scope.chats.detach(chatId);
        };
    }, [scope, chatId, cwd]);
    const send = (text: string, extras: ChatSendExtras): void => {
        setError(null);
        setFailed(null);
        void scope.chats.send(chatId, text, extras).catch((cause: unknown) => {
            setFailed({ text, extras });
            setError(cause instanceof Error ? cause.message : String(cause));
        });
    };
    return (
        <div className="flex h-full min-h-0 flex-col">
            {error && <p role="alert">{error}</p>}
            {failed && <Button onClick={() => send(failed.text, failed.extras)}>Retry message</Button>}
            <Timeline
                chatId={chatId}
                composer={
                    info && (
                        <Composer
                            chatId={chatId}
                            info={info}
                            focused
                            disabled={!connected}
                            providerFixed={false}
                            onSend={send}
                            onRetarget={(provider, selection) => scope.chats.retarget(chatId, provider, selection)}
                        />
                    )
                }
            />
        </div>
    );
}

export function ChatView({ scope, chatId, cwd }: { scope: ChatScope; chatId: string; cwd: string }) {
    return (
        <ChatScopeContext.Provider value={scope}>
            <Thread key={chatId} chatId={chatId} cwd={cwd} />
        </ChatScopeContext.Provider>
    );
}
```

The single failed-message slot above is a minimal example. A host that allows multiple queued sends or unmounts a thread while sending needs an outgoing-message collection outside the component. Do not claim that the composer restores failed uploads automatically. See [diff workers](./styling#diff-workers-and-lazy-modules) if the thread can show file changes.

Keep one mounted lifecycle owner per chat ID per client. The registry holds one entry, not a reference count; two independent components that both open and detach the same ID can detach each other's thread.

## Read state without relaying every streamed word

`useChats` keeps `byKey` and `statusByKey`. A chat row contains `info`, `items`, `structure`, `order`, and optional `history`, `waitingBefore`, and `bookmarks`. `useChatRow(chatId, selector)` applies the surrounding scope's `keyOf`. It throws through `useChatScope()` outside a provider.

`items` receives text/output deltas. `structure` remains stable for most deltas so the timeline does not regroup on every word. The first delta of an empty reply does update structure. Custom rows should derive their grouping from `structure` and read live item text with `useCurrentItem(chatId, derived)`.

The status-only map follows `info` changes, including chats that have no visible thread. Do not expect a transcript to exist merely because a status row exists.

## History and temporary inspection

`loadEarlier(chatId, cursor)` shares one pending request per chat and requests another 60 items. A `history-expired` refusal reattaches from the newest page when the chat is still mounted. `prependPage` ignores a response for a cursor no longer held by the store.

Pending approvals/questions before the loaded page live in `waitingBefore`, outside `order`. Use `waitingRequestsOf` to include them. Reading only visible transcript items would hide an older blocking approval.

`inspect(chatId)` reads a 100-item attach snapshot and shares concurrent inspections. Its finalizer detaches only if the chat is not mounted. It does not register a long-lived mount or reset the sink. Use it for previews; use `open` for a live thread.

`setPreferences(payload)` remembers host defaults and resends them on each open connection. The host may derive that payload with `chatPreferencesPayload` and subscribe to preference changes; the client does not subscribe to the preference store itself.

The [runtime reference](./reference-runtime#chat-client) lists the remaining client operations and return values.
