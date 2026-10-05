# Runtime reference

Every table uses a subpath relative to `@adecore/agents-react/`. Links open the corresponding source module and its exact types. There is no root barrel. Default resolution selects compiled JavaScript and declarations; `source` selects TypeScript.

Many component props and method option interfaces are not named exports. Use `ComponentProps<typeof Composer>` or `Parameters<ChatClient['open']>[1]` to derive them rather than importing an unexported `ComposerProps` or `ChatOpenOptions`.

## Transport

`ChatTransport` is the renderer's typed connection:

```ts
import type { ChatTransport } from '@adecore/agents-react/transport';

export type Request = ChatTransport['request'];
export type SubscribeEvent = ChatTransport['on'];
export type SubscribeStatus = ChatTransport['subscribeStatus'];
```

| Member                     | Contract                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `request(type, payload)`   | Generic over `AgentRequestType`; resolves the schema's result or rejects with a coded error |
| `on(event, handler)`       | Generic over `AgentEventType`; returns unsubscribe                                          |
| `status`                   | `connecting`, `open`, or `closed`                                                           |
| `subscribeStatus(handler)` | Returns unsubscribe; notify on actual link transitions                                      |

`ChatTransportError(code, message)` preserves a string code. `errorCode(error)` accepts any error object carrying a string `code` and returns null otherwise. `isConnectionError` recognizes only `not-connected` and `disconnected`.

`portTransport(port: FramePort): PortTransport` validates incoming envelopes, event payloads, and reply results. Malformed/unknown events are dropped with warnings. A malformed result rejects with `bad-reply`. A send that throws rejects with `not-sent`. It starts open, has no built-in request timeout, and does not detect native port termination automatically. Its owner must call `close()`, which rejects pending requests with `disconnected`, stops frame listening, and reports closed. Requests after close reject with `not-connected`. No request cancellation signal is part of this interface.

## Scope and host

`ChatScope` contains `{ id, keyOf, owns, transport, chats }`. Its ID partitions provider/account/usage rows, and `keyOf` partitions chat rows. `useChatScope()` throws outside `ChatScopeContext`. `setChatHost(patch: Partial<ChatHost>)` merges top-level fields and configures storage when supplied. The host is global across scopes; [host adapters](./host) lists the defaults and nested contracts.

## Runtime modules

These modules connect a scope to the host without importing provider/backend code into the renderer.

| Subpath                                                                                                            | Public exports                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`host`](https://github.com/basmilius/adecore/blob/main/packages/agents-react/src/host.ts)                         | `AccentChoice`, `ChatToast`, `ChatActions`, `FileRef`, `ChatPlace`, `SubagentTask`, `TimelineFindOptions`, `TimelineFind`, `ComposerDictationProps`, `TextareaProps`, `ResourceUrl`, `ComposerSlotProps`, `SubagentSlotProps`, `ThreadCard`, `ReplyAuthor`, `ChatHost`, `setChatHost`, `chatHost` |
| [`lazy`](https://github.com/basmilius/adecore/blob/main/packages/agents-react/src/lazy.tsx)                        | `setLazyPrefetch`, `onLazyOpenError`, `lazyNamed`                                                                                                                                                                                                                                                 |
| [`locales`](https://github.com/basmilius/adecore/blob/main/packages/agents-react/src/locales.ts)                   | `AGENTS_NAMESPACES`, `AgentsNamespace`, `AGENTS_LOCALES`                                                                                                                                                                                                                                          |
| [`mounted-registry`](https://github.com/basmilius/adecore/blob/main/packages/agents-react/src/mounted-registry.ts) | `MountedEntry`, `MountedRegistry`                                                                                                                                                                                                                                                                 |
| [`port-transport`](https://github.com/basmilius/adecore/blob/main/packages/agents-react/src/port-transport.ts)     | `PortTransport`, `portTransport`                                                                                                                                                                                                                                                                  |
| [`scope`](https://github.com/basmilius/adecore/blob/main/packages/agents-react/src/scope.ts)                       | `ChatScope`, `ChatScopeContext`, `useChatScope`                                                                                                                                                                                                                                                   |
| [`transport`](https://github.com/basmilius/adecore/blob/main/packages/agents-react/src/transport.ts)               | `ChatRequestMap`, `ChatEventMap`, `ChatTransportStatus`, `ChatTransport`, `ChatTransportError`, `errorCode`, `isConnectionError`                                                                                                                                                                  |

## Chat client

`new ChatClient(transport, sink, providers?)` subscribes immediately. It requests current statuses when the link is already open, and provider data if a provider sink was supplied. [Chat lifecycle](./chat-lifecycle) covers attach races, pagination, and cleanup.

| Method                                  | Result and ownership                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| `open(chatId, options)`                 | `Promise<boolean>`; false for connection loss, throws other refusals; registers one mount |
| `detach(chatId)`                        | `Promise<void>`; stops streaming, does not cancel the agent                               |
| `inspect(chatId)`                       | `Promise<ChatAttachResult>`; temporary 100-item attach read, deduplicated by ID           |
| `retarget(chatId, provider, selection)` | `Promise<void>`; kill/recreate a mounted empty chat, discarding old account/seq           |
| `send(chatId, text, extras?)`           | `Promise<{ queued: boolean; turnId?: string }>`                                           |
| `clear(chatId, force = false)`          | `Promise<void>`; a busy chat can refuse unless forced                                     |
| `kill(chatId)`                          | `Promise<void>`; forgets local mount/state before requesting kill                         |
| `loadEarlier(chatId, cursor)`           | `Promise<void>`; one pending history read per chat                                        |
| `loadStatuses()`, `loadProviders()`     | `Promise<void>`; tolerate unavailable/older hosts and retain known data                   |
| `setPreferences(payload)`               | Void; remembers and sends defaults now and after reconnect                                |
| `listSkills(chatId)`                    | `Promise<ChatSkill[]>`                                                                    |
| `addBookmark(chatId, itemId, name?)`    | `Promise<ChatBookmark[]>`                                                                 |
| `renameBookmark(chatId, itemId, name)`  | `Promise<ChatBookmark[]>`; empty name removes the name                                    |
| `removeBookmark(chatId, itemId)`        | `Promise<ChatBookmark[]>`                                                                 |
| `isMounted(chatId)`                     | Boolean                                                                                   |
| `dispose()`                             | Void; releases subscriptions and initiates detaches, leaves agents running                |

## Actions

`transportActions(transport)` maps each action to a request. `actionsOf(scope)` and `useChatActions()` use `ChatHost.actions` when non-null. The custom object is global and must route IDs correctly.

| Action               | Arguments after `chatId`                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `clear`              | `force: boolean`                                                                                |
| `stopTurn`           | `subagents: boolean`                                                                            |
| `unqueue`, `sendNow` | `messageId: string`                                                                             |
| `compact`            | None                                                                                            |
| `configure`          | `patch: Omit<ChatConfigurePayload, 'chatId'>`                                                   |
| `continueOn`         | `account: string`                                                                               |
| `turnDiff`           | `turnId: string`; resolves `ChatCheckpointDiff \| null`                                         |
| `stopSubagent`       | `toolUseId: string`                                                                             |
| `stopTask`           | `taskId: string`                                                                                |
| `approve`            | `requestId`, `decision: 'allow'                \| 'allow-always' \| 'deny'`, optional `message` |
| `answer`             | `requestId`, `answers: Record<string, string>`                                                  |
| `dismiss`            | `itemId: string`                                                                                |

All actions return promises. `unqueue` rejects with `request-not-found` if a compatible backend answers without a message because it already went out. Preserve backend codes on custom adapters.

## State modules

Nonpersistent chat/provider/account stores use ordinary Zustand stores. Usage has persistent choices and transient per-scope data. Scoped hooks use the active `ChatScope`; direct stores expect explicit keys or scope IDs.

| Subpath                                                                                                                          | Public exports                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`chat/actions`](https://github.com/basmilius/adecore/blob/main/packages/agents-react/src/chat/actions.ts)                       | `transportActions`, `actionsOf`, `useChatActions`                                                                                                                                                                     |
| [`chat/chat-client`](https://github.com/basmilius/adecore/blob/main/packages/agents-react/src/chat/chat-client.ts)               | `ChatSendExtras`, `ChatClient`                                                                                                                                                                                        |
| [`state/chats`](https://github.com/basmilius/adecore/blob/main/packages/agents-react/src/state/chats.ts)                         | `ChatState`, `ChatHistoryPage`, `ChatPage`, `ChatsById`, `ChatStatuses`, `ChatSink`, `prependPage`, `waitingRequestsOf`, `applyEvent`, `useChats`, `chatSink`, `useChatRow`, `useCurrentItem`                         |
| [`state/provider-accounts`](https://github.com/basmilius/adecore/blob/main/packages/agents-react/src/state/provider-accounts.ts) | `ProviderAccountsRow`, `useProviderAccountsStore`, `useProviderAccounts`, `providerAccountsOf`, `knownAccounts`, `watchProviderAccounts`                                                                              |
| [`state/providers`](https://github.com/basmilius/adecore/blob/main/packages/agents-react/src/state/providers.ts)                 | `ProvidersRow`, `useProvidersStore`, `useProviders`, `providersOf`, `providerSinkFor`                                                                                                                                 |
| [`state/usage`](https://github.com/basmilius/adecore/blob/main/packages/agents-react/src/state/usage.ts)                         | `UsagePeriod`, `UsageMetric`, `USAGE_PERIODS`, `USAGE_PREFERENCES_KEY`, `usagePreferencesKey`, `dayOf`, `windowFor`, `summaryPayload`, `askedKey`, `reloadUsagePreferences`, `useUsageStore`, `UsageView`, `useUsage` |

## Persistence module

See [persistence](./persistence) before using any store. `ChatStorageRecord` is the four-record union. `onChatStorageConfiguration` registers a configuration listener and has no unsubscribe return; use it for module-lifetime integrations rather than a repeatedly mounted hook.

| Subpath                                                                                          | Public exports                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`storage`](https://github.com/basmilius/adecore/blob/main/packages/agents-react/src/storage.ts) | `ChatStorageRecord`, `ChatStorageAdapter`, `ChatStorageOptions`, `onChatStorageConfiguration`, `configureChatStorage`, `chatStorageKey`, `chatStorageLegacyKeys`, `chatStorageAdapter`, `hydrateChatStorage`, `createChatStore` |

`createChatStore(initial, hydrate)` wraps hook/getState/subscribe/setState access in lazy hydration. `hydrateChatStorage()` hydrates the registered stores once. `chatStorageAdapter()` returns the configured adapter, null for memory-only/denied storage, or browser localStorage. These lower-level functions do not establish independent per-scope persistence.

`MountedRegistry` is a map of mounted entries with `attached: boolean`. `detachAll(report?)` marks them unattached. `reattachAll(callback)` snapshots the registry and processes at most four concurrently, skips replaced/deleted/attached entries, and catches individual failures. It is not a reference-counted mount registry.

`lazyNamed(loader, name)` wraps a named component export and registers its loader. `setLazyPrefetch(register)` offers past/future loaders; `onLazyOpenError(listener)` returns unsubscribe and reports render-load failures only. Use a render error boundary and Suspense.
