# Host adapters

`setChatHost(patch)` hands the views what only the app around them can decide. Call it once, before the first render. `chatHost()` answers what is set now. The host is one for the whole page, shared by every scope, so a function that is about one host of chats gets its `scopeId`.

```ts
import { setChatHost, chatHost } from '@adecore/agents-react/host';
```

A patch replaces top-level fields only: to change one function of `code`, `prompts`, `attachments`, `accents`, `tasks`, `confirm` or `dictation`, pass the whole object. A change is not React state and redraws nothing, so hand stable functions and let the hooks among them read your own state. A field whose name starts with `use` is called as a React hook.

## Fields

| Field                              | Without it                                         | What it is for                                                                                         |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `storage`                          | `localStorage`, under `adecore.*`                  | Where drafts and preferences are kept. See [Persistence](/agents-react/guide/persistence).              |
| `notify(toast)`                    | Nothing is shown                                   | A `ChatToast`: errors, successes, and a deletion with an undo `action`.                                |
| `actions`                          | Every action is a request on the scope's transport | A `ChatActions` of your own, to run each action through a door of your own.                            |
| `searchFiles(scopeId, cwd, query, limit)` | No `@` file picker                          | Relative paths under `cwd` for the composer's picker.                                                  |
| `attachments`                      | No previews; reading rejects                       | `useUrl` for a URL to an attached file's bytes, `read` for the bytes as a `Blob`.                      |
| `ReadImage`                        | Nothing under a tool that read an image            | A component that draws the image at `path`.                                                            |
| `fileLinks`                        | Paths in a reply stay text                         | `target(text, cwd)` finds a `FileRef` in text, `open(cwd, ref)` opens it.                              |
| `code`                             | Light, `github-light` and `github-dark`            | `useMode()` follows the app's light or dark, `useThemes()` names the Shiki themes, `custom` registers your own. |
| `useStreaming()`                   | `words`                                            | How a reply appears while it streams: `words`, `blocks` or `whole`.                                    |
| `useTimelineFind(options)`         | No find in a thread                                | Find in a thread: you get the rows and refs, you hand back a `TimelineFind` with the bar to draw.      |
| `dictation`                        | `PlainTextarea`, no dictation button               | A `Textarea` for written answers, and an editor extension plus a control for the composer.             |
| `prompts`                          | No prompts of your own                             | Approvals or questions of your own beside a chat's. See [Prompts](/agents-react/chat/prompts#prompts-of-your-own). |
| `useReferableChats()`              | No chats in the `@` picker                         | Other chats a message may point at, as `{ id, title }`.                                                |
| `openLogin(scopeId, kind, accountId, name)` | No log in button                          | Runs a CLI's own login somewhere a command can run, such as a terminal.                                |
| `useLoginBlocked(scopeId)`         | Login is always possible                           | Why a login cannot start right now, or `null`.                                                         |
| `useProjectLook(scopeId, projectId)` | The folder's own name                            | A project's name and mark on the usage page.                                                           |
| `useChatPlace(chatId)`             | Links to other chats lead nowhere                  | Where another chat is (`title`, `go()`), for a fork's way back. A `null` title is a chat that is gone. |
| `useContextSources(chatId)`        | Nothing                                            | What a chat may read besides its folder, named under an empty thread.                                  |
| `useHidesFolder(chatId)`           | `false`                                            | Hide the working folder under an empty thread.                                                         |
| `useWelcome(chatId)`               | `false`                                            | Open an empty chat on a greeting with the composer under it.                                           |
| `tasks`                            | No tasks                                           | `useTasks` and `useTask`: the tasks behind subagent rows your app opened itself.                       |
| `confirm`                          | Runs at once                                       | `stopSubagents` and `stopTask` get a `run` to call once a person confirmed.                            |
| `fork(chatId, turnId)`             | No fork action                                     | Offers a fork after a turn; where it lands is up to you.                                               |
| `openSettings(section)`            | Nothing                                            | Opens your settings on `providers` or `agents`.                                                        |
| `useResumeAtReset(scopeId)`        | `true`                                             | Whether a chat may go on by itself once the limit it stopped on lifts.                                 |
| `useComposerPlaceholder(scopeId, chatId)` | The chat's own                              | The first words of an empty composer.                                                                  |
| `ComposerSlot`                     | Nothing                                            | A control of your own in the composer's row, with `insert(text)` to type into the draft.               |
| `SubagentSlot`                     | One flyout                                         | Chips of your own for a chat's subagents over the composer.                                            |
| `useThreadCards(scopeId, chatId)`  | No cards                                           | Cards of your own between the messages, each `{ id, at, render }`.                                     |
| `useReplyAuthor(scopeId, chatId)`  | The agent is named for screen readers only         | A header over each reply: `{ name, mark? }`.                                                           |
| `accents`                          | No colors                                          | The colors an account may wear: `all`, the `featured` ones, a `label` and the `current` accent.        |
| `isApplePlatform()`, `isAppShortcut(event)` | From `@adecore/ui`; no shortcut           | Which modifier is Mod, and keys the app keeps even while the composer has focus.                       |

A default leaves a part out; it is not a policy. A view's `disabled` stops nothing on the host: the host checks every request itself.

## Actions

The views run every action on a chat through a `ChatActions`: clear, stop, unqueue, send now, compact, configure, continue on another account, read a turn's diff, stop a subagent or a task, approve, answer and dismiss. With `actions: null` each one is the request of the same name on the transport of the scope it runs in (`transportActions(transport)`). `useChatActions()` and `actionsOf(scope)` answer the set in use.

A set of your own is one for the page and gets only chat ids, so it has to know which host each chat is on. Wrap the requests rather than replace them, and keep the `code` of a refusal:

```ts
import { transportActions } from '@adecore/agents-react/chat/actions';
import { setChatHost, type ChatActions } from '@adecore/agents-react/host';

const base = transportActions(transport);
const actions: ChatActions = {
    ...base,
    stopTurn: async (chatId, subagents) => {
        activityLog.add(`Stopped ${chatId}`);
        await base.stopTurn(chatId, subagents);
    }
};

setChatHost({ actions });
```

## Slots and cards

`ComposerSlot` gets `{ scopeId, chatId, disabled, insert }`; `insert(text)` puts text at the caret, a space apart from its neighbors, and focuses the editor. `SubagentSlot` gets `{ chatId, items }` and is drawn only when there are subagents. A thread card has an `id` unique in the chat, an `at` on the clock of the items' `createdAt`, and a `render()` that runs only while the card is on screen. Return the same array from `useThreadCards` while nothing changed: a new array lays out every row again.

```tsx
import { Button } from '@adecore/ui';
import { setChatHost, type ComposerSlotProps } from '@adecore/agents-react/host';

function InsertSelection({ disabled, insert }: ComposerSlotProps) {
    return (
        <Button size="sm" disabled={disabled} onClick={() => insert(editor.selectedText())}>
            Insert selection
        </Button>
    );
}

setChatHost({ ComposerSlot: InsertSelection });
```

## Lazy modules

The diff views and a few heavy parts load on first use. `setLazyPrefetch(register)` hands every such loader to a prefetcher of yours, the ones made so far and every later one. `onLazyOpenError(listener)` tells you when a loader fails during a render, and answers the function that stops listening; a failed prefetch does not reach it. `lazyNamed(load, name)` is the `React.lazy` they are made with, for a module that exports its component by name.
