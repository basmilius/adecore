# Chat client and state

## ChatTransport

Everything the views need of a host goes through one object:

```ts
interface ChatTransport {
    request<T extends AgentRequestType>(type: T, payload: ChatRequestMap[T]['payload']): Promise<ChatRequestMap[T]['result']>;
    on<E extends AgentEventType>(event: E, handler: (payload: ChatEventMap[E]) => void): () => void;
    readonly status: 'connecting' | 'open' | 'closed';
    subscribeStatus(handler: (status: ChatTransportStatus) => void): () => void;
}
```

The names and payloads are those of the [agent protocol](/agent-contracts/protocol). A refused request rejects with an error with a string `code`. `ChatTransportError(code, message)` is such an error, `errorCode(error)` reads the code of any error, and `isConnectionError(error)` is true for `not-connected` and `disconnected`. A reconnecting socket keeps the same transport object and reports through `subscribeStatus`; when `status` turns `open` again, the views reload their state.

`portTransport(port)` is a transport over a [`FramePort`](/agent-contracts/protocol#frameport). It is open from the start, drops malformed frames with a warning, and rejects a result that fails its schema with `bad-reply`. It cannot reconnect and has no timeout. The port's owner calls `close()`, which rejects waiting requests with `disconnected`, and closes the port itself.

## ChatClient

`new ChatClient(transport, sink, providers?)` holds one connection's chats. It writes into a `ChatSink`: `chatSink(keyOf)` for the shared store, and `providerSinkFor(scopeId)` for the list of CLIs.

| Method                                  | What it does                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `open(chatId, options)`                 | Creates or loads the chat and attaches with the newest page of items. `false` while the transport is down; it attaches once it is up. |
| `detach(chatId)`                        | Stops streaming the chat here. The agent goes on.                                                |
| `send(chatId, text, extras?)`           | Returns `{ queued, turnId? }`: whether it waits behind a running turn.                           |
| `retarget(chatId, provider, selection)` | Moves a chat that has not spoken yet to another CLI.                                             |
| `loadEarlier(chatId, cursor)`           | Reads the page before the oldest item held.                                                      |
| `inspect(chatId)`                       | Reads the recent items once, without attaching, for a preview.                                   |
| `clear(chatId, force?)`                 | Starts the chat over; refused with `chat-busy` during a turn unless `force`.                     |
| `restart(chatId)`                       | Ends the chat's CLI and keeps the conversation for the next message; refused with `chat-busy` while the chat works. |
| `kill(chatId)`                          | Forgets the chat here and asks the host to remove it.                                            |
| `listSkills(chatId)`                    | The CLI's skills, for the `$` picker.                                                            |
| `addBookmark`, `renameBookmark`, `removeBookmark` | Return the chat's whole bookmark list.                                                 |
| `removeVisual(chatId, visualId)`        | Deletes a visual for good and returns the chat's visuals.                                        |
| `setPreferences(payload)`               | Tells the host the defaults for chats it starts itself, also after every reconnect.             |
| `loadProviders()`, `loadStatuses()`     | Reload the CLIs and every chat's status; `open` does this too.                                  |
| `isMounted(chatId)`, `dispose()`        | Whether a chat is open here, and releasing everything. `dispose` leaves the agents running.     |

`open` takes `provider`, `account`, `cwd`, `resume`, `selection` and `runtimeMode` for a new chat; an existing chat keeps its own. On a reconnect the client reattaches every open chat and catches up on what it missed. Open a chat id once per client, since a second `open` and a `detach` cancel each other.

Close a scope in the reverse order of opening it:

```ts
stopAccounts();
scope.chats.dispose();
transport.close();
useChats.getState().forgetWhere(scope.owns);
useProvidersStore.getState().forget(scope.id);
useProviderAccountsStore.getState().forget(scope.id);
useUsageStore.getState().forget(scope.id);
```

## Reading the stores

The stores are Zustand stores shared by every scope.

- `useChats` holds a `ChatState` per key: `info`, `items` by id, `order`, `history` when only the newest page is held, `waitingBefore`, `subagentsBefore`, `workflowsBefore` and `outlineBefore` for what lies before that page, `bookmarks` and `visuals`. `statusByKey` holds only the info and changes only with it.
- `useChatRow(chatId, select)` reads one chat of the scope in context. Select only the field you draw, since a streamed word replaces `items`.
- `structure` is `items` without the growth of streaming text. Derive rows from it, so a word does not redraw the whole thread.
- `waitingRequestsOf(chat)` lists every waiting approval and question, also those before the loaded page.
- `useProviders(select)` and `useProviderAccounts(select)` read the CLIs and accounts of the scope in context; `providersOf(scopeId)` and `providerAccountsOf(scopeId)` do the same outside React. `knownAccounts(row)` is `undefined` until the host answered and `null` for a host without accounts.
- `applyEvent(state, event)` is the pure step the store takes for an event, for a store of your own.

```tsx
function Title({ chatId }: { chatId: string }) {
    const title = useChatRow(chatId, (row) => row?.info.suggestedTitle ?? 'New chat');
    return <span>{title}</span>;
}
```
