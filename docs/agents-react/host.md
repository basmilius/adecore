# Host adapters

`setChatHost(patch)` supplies the behavior around chats. Call it once before the first render, with stable hook functions for the lifetime of the renderer. `chatHost()` returns the current singleton. All scopes share it; hooks that need a backend receive its `scopeId`.

A patch merges top-level fields only. Replacing `code`, `prompts`, `attachments`, `accents`, `tasks`, `confirm`, or `dictation` requires the entire nested value. Updating it is not a React state change and does not notify components. Use your own subscribed hook inside a stable adapter to expose changing host state.

## Defaults and required boundaries

| Adapter                                       | Default                                                    | Host responsibility                                                     |
| --------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| `storage`                                     | Browser storage on first use, `adecore` namespace          | Configure before hydration; preserve existing records                   |
| `notify`                                      | No-op                                                      | Display errors, success, and undo actions                               |
| `actions`                                     | `null`, use the scope transport                            | Route custom actions, enforce authorization, throw refusals with `code` |
| `searchFiles`                                 | `null`, no file search                                     | Authorized relative paths under the supplied `cwd`                      |
| `attachments`                                 | No URL, rejecting read                                     | Resolve stored bytes; revoke temporary URLs                             |
| `fileLinks`, `ReadImage`, `fork`, `openLogin` | `null`                                                     | Validate paths and destinations before opening                          |
| `useTimelineFind`                             | Closed find with no bar                                    | Search, hit highlighting, and reveal actions                            |
| `dictation`                                   | `PlainTextarea`, no composer control                       | Microphone access and extensions if offered                             |
| `prompts`                                     | No extra prompts                                           | Render and answer host-owned requests                                   |
| `tasks`                                       | No task state                                              | Subscribe to task state on the correct scope                            |
| `confirm`                                     | Immediately call `run`                                     | Add confirmation policy if required                                     |
| `code`                                        | Light mode; `github-light`/`github-dark`; no custom themes | Theme mode hooks and custom Shiki registrations                         |
| `useStreaming`                                | `words`                                                    | Choose `words`, `blocks`, or `whole`                                    |
| `useWelcome`, `useHidesFolder`                | `false`                                                    | Greeting layout and folder visibility                                   |
| `useResumeAtReset`                            | `true`                                                     | Decide whether automatic continuation is permitted                      |

Omitted navigation, settings, toast, and context hooks do nothing. Omitted arrays are stable empty arrays. Defaults make a minimal chat possible; they do not establish a security policy. A view's `disabled` or `readOnly` prop cannot authorize backend operations.

## Route actions through the correct scope

`transportActions(transport)` returns the complete `ChatActions` object. `actionsOf(scope)` and `useChatActions()` choose the singleton custom actions if supplied, otherwise cache transport actions for the scope. Most hosts should keep `actions: null`; a global custom actions object receives chat IDs, not a scope ID, so its routing must be unambiguous.

A custom action wraps a real action and preserves structured refusal codes:

```ts
import { transportActions } from '@adecore/agents-react/chat/actions';
import { setChatHost, type ChatActions } from '@adecore/agents-react/host';
import type { ChatTransport } from '@adecore/agents-react/transport';

export function installSingleHostActions(transport: ChatTransport, authorize: (chatId: string, operation: string) => Promise<void>): void {
    const base = transportActions(transport);
    const actions: ChatActions = {
        ...base,
        approve: async (chatId, requestId, decision, message) => {
            await authorize(chatId, `approval:${decision}`);
            await base.approve(chatId, requestId, decision, message);
        }
    };
    setChatHost({ actions });
}
```

`authorize` is a host-provided adapter. It rejects with an error carrying a string `code`; the backend must independently check the operation. Use this single-host composition only when all chat actions go to that transport.

## Hooks and custom components

A `use*` adapter is called as a React hook. Keep its identity and hook order stable. Return stable arrays from `prompts.useExtra`, `useReferableChats`, `useContextSources`, and especially `useThreadCards` while their data is unchanged. Every new thread-card array triggers row layout work.

`ComposerSlot` receives `{ scopeId, chatId, disabled, insert }`; `insert(text)` replaces the selection, adds separating spaces where needed, and focuses the input. `SubagentSlot` receives `{ chatId, items }` only when the child list is nonempty. `useReplyAuthor` returns `{ name, mark? }` or null. Thread cards are `{ id, at, render }`; `at` uses the chat's `createdAt` clock in milliseconds, and `render` runs only for visible rows.

```tsx
import { Button } from '@adecore/ui';
import { setChatHost, type ComposerSlotProps, type ThreadCard } from '@adecore/agents-react/host';

const cards: readonly ThreadCard[] = [{ id: 'host-checkpoint', at: 1000, render: () => <p>Host checkpoint saved</p> }];

function InsertContext({ disabled, insert }: ComposerSlotProps) {
    return (
        <Button disabled={disabled} onClick={() => insert('Review the selected section')}>
            Insert context
        </Button>
    );
}

export function installChatParts(): void {
    setChatHost({
        ComposerSlot: InsertContext,
        useComposerPlaceholder: () => 'Describe the change',
        useThreadCards: () => cards,
        useReplyAuthor: () => ({ name: 'Assistant' })
    });
}
```

This fixed checkpoint is a rendering fixture. A real host supplies timestamps and cards for each chat. Cards stay in the renderer and are never protocol items.

## Async ownership

The adapter that creates a subscription releases it. The adapter that creates an object URL revokes it. File search has no `AbortSignal`; the composer ignores stale responses and cancels its debounce timer, but it cannot cancel the underlying host request. Attachment reads, login, prompt answers, and custom actions are promises with no package cancellation signal. Apply host timeouts and cancellation where needed, and retain any failed outgoing messages in host state.

`setLazyPrefetch(register)` registers existing and future diff loaders with the host prefetcher. `onLazyOpenError(listener)` returns an unsubscribe function and reports failures during a render load. Prefetch failures do not reach that listener. Use Suspense and an error boundary for render failures; loader failure does not stop a provider turn.

See [attachments](./attachments) for a complete resource adapter, [approvals](./approvals-tasks) for prompt ownership, and the [runtime reference](./reference-runtime) for related entrypoints.
