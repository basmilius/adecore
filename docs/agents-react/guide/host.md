# Host adapters

A `ChatHostProvider` hands the views under it what only the app can decide. Render one around everything that draws a chat. Keep its `host` in a constant, because the provider reads it once, on mount. One host may serve several scopes, so a function about one scope gets its `scopeId`.

```tsx
import { ChatHostProvider, type ChatHost } from '@adecore/agents-react';

const CHAT_HOST: Partial<ChatHost> = {
    notify: (toast) => showToast(toast),
    useStreaming: () => useSettings((settings) => settings.streaming)
};

createRoot(element).render(
    <ChatHostProvider host={CHAT_HOST}>
        <App />
    </ChatHostProvider>
);
```

`useChatHost()` returns the host of the nearest provider, or the defaults outside one.

A field whose name starts with `use` is a React hook. The provider throws when it gets another `host` object later, since a mounted view would then call other hooks. Hand stable functions and let the hooks read your own state. To swap the host, give the provider a new `key`.

## A part that loads later

A nested provider starts from the host above it and replaces the top-level fields it sets. To change one function of an object field such as `code` or `prompts`, pass the whole object. A part of the app that loads later renders its own provider around what it draws. Views outside it keep the host they mounted with.

```tsx
const WORKSPACE_HOST: Partial<ChatHost> = {
    useTimelineFind,
    fileLinks: { target: fileTarget, open: openFile }
};

export function Workspace() {
    return (
        <ChatHostProvider host={WORKSPACE_HOST}>
            <Panels />
        </ChatHostProvider>
    );
}
```

## Fields

| Field                              | Without it                                         | What it is for                                                                                         |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `notify(toast)`                    | Nothing is shown                                   | A `ChatToast`: errors, successes, and a deletion with an undo `action`.                                |
| `actions`                          | Every action is a request on the scope's transport | A `ChatActions` of your own. See [Actions](#actions).                                                  |
| `searchFiles(scopeId, cwd, query, limit)` | No `@` file picker                          | Relative paths under `cwd` for the composer's picker.                                                  |
| `attachments`                      | No previews; reading rejects                       | `useUrl` for a URL to an attached file's bytes, `read` for the bytes as a `Blob`.                      |
| `ReadImage`                        | Nothing under a tool that read an image            | A component that draws the image at `path`.                                                            |
| `MarkdownImage`                    | An image in a reply loads its target as written    | A component that draws the image at `path`, a file a reply names, absolute or under the chat's cwd.    |
| `ModelView`                        | A model shows as a row with its name and caption   | A component that draws the 3D model of a [Model](/intelligent-ui/components/content#model) block from `UiModelViewProps`. |
| `intelligentUi`                    | Choices stay closed, live values and links stay as first read | `sendChoice`, `query`, `link`, `openLink`, `openUrl` and `subscribe` for [Intelligent UI](/intelligent-ui/guide/getting-started#draw-the-blocks) blocks. |
| `fileLinks`                        | Paths in a reply stay text                         | `target(text, cwd, scopeId)` finds a `FileRef`; `open(cwd, ref, scopeId)` opens it.                   |
| `code`                             | Light, `github-light` and `github-dark`            | `useMode()` for light or dark, `useThemes()` for the Shiki themes, `custom` for your own themes. Optional `syntaxWorker()`, `highlighter()` and `editor()`, see [Diff syntax worker](#diff-syntax-worker). |
| `useStreaming()`                   | `words`                                            | How a reply appears while it streams: `words`, `blocks` or `whole`.                                    |
| `useSendDelivery()` | `queue` | What Send does while a turn runs: `queue` waits for the turn to end, `steer` hands the message to the running turn. Option or Alt picks the other one. |
| `useHidesToolCalls(scopeId, chatId)` | `false`                                          | Leave tool lines out of a thread and a subagent's work. Generated images and the turn's duration stay. |
| `commandLooks`                     | Every shell call reads as itself                   | Programs of your own drawn as tools of their own in a thread. See [Programs as tools](/agents-react/chat/timeline#programs-as-tools). |
| `useTimelineFind(options)`         | No find in a thread                                | Find in a thread: you get the rows and refs, you hand back a `TimelineFind` with the bar to draw.      |
| `dictation`                        | `PlainTextarea`, no dictation button               | A `Textarea` for written answers, and an editor extension plus a control for the composer.             |
| `prompts`                          | No prompts of your own                             | Approvals or questions of your own beside a chat's. See [Prompts](/agents-react/chat/prompts#prompts-of-your-own). |
| `useReferableChats()`              | No chats in the `#` picker                         | Other chats a message may point at, as `{ id, title }`.                                                |
| `useReferables(scopeId, chatId)`   | The chats of `useReferableChats`                   | What a message may point at with `#`, as `Referables`: `items` of `Referable` (`id`, `name`, a `ReferableKind`, `detail?`, `group` of `canvas` or `views`) and `chatsOnly`. A reply that writes `#Name` exactly draws a chip too; an ambiguous name stays text. |
| `ReferenceIcon`                    | The mark of the reference's kind (`REFERENCE_ICONS`) | A component that draws the mark of a `#` reference from `ReferenceIconProps` (`id`, `kind`, `size`, `className?`), such as an icon a person picked. The composer draws it outside the provider, so it reads no context. |
| `openLogin(scopeId, kind, accountId, name)` | No log in button                          | Runs a CLI's own login somewhere a command can run, such as a terminal.                                |
| `useLoginBlocked(scopeId)`         | Login is always possible                           | Why a login cannot start right now, or `null`.                                                         |
| `useCanReorderAccounts(scopeId)`   | The host keeps the order                           | Whether the host answers `accounts.reorder`, which shows the drag handles in Providers.                |
| `useAccountRule(scopeId, chatId)`  | Every account that is on is offered                | Per CLI, the account a chat's project starts on and the accounts it never offers.                      |
| `runProviderCommand(scopeId, kind, command)` | Install page offers Copy only     | Runs an install or sign-in command where a person sees it, such as a terminal on the scope's machine. |
| `useMachinePlatform(scopeId)`      | The system of the page                             | `darwin`, `linux` or `win32` of the scope's machine, whose install command the install page shows first. |
| `providerKeyNote(variable)`        | Nothing                                            | A sentence after an environment key the install page asks for. `null` adds none.                      |
| `useProjectLook(scopeId, projectId)` | The folder's own name                            | A project's name and mark on the usage page.                                                           |
| `useMachineLabel(scopeId)`         | A version requirement names no machine             | The machine's name, for "Requires Claude Code 2.1 or later on &lt;machine&gt;".                       |
| `useChatPlace(chatId)`             | Links to other chats lead nowhere                  | Where another chat is (`title`, `go()`), for a fork's way back. A `null` title is a chat that is gone. |
| `useContextSources(chatId)`        | Nothing                                            | What a chat may read besides its folder, named under an empty thread.                                  |
| `useHidesFolder(chatId)`           | `false`                                            | Hide the working folder under an empty thread.                                                         |
| `useWelcome(chatId)`               | `false`                                            | Open an empty chat on a greeting with the composer under it.                                           |
| `tasks`                            | No tasks                                           | `useTasks` and `useTask`: the tasks behind subagent rows your app opened itself.                       |
| `confirm`                          | Runs at once                                       | `stopSubagents` and `stopTask` get a `run` to call once a person confirmed.                            |
| `fork(chatId, turnId)`             | No fork action                                     | Offers a fork after a turn; where it lands is up to you.                                               |
| `openNewChat(scopeId, chatId)`     | Mod+Alt+Enter sends the other way, like Alt+Enter  | After Mod+Alt+Enter sent a message, opens a new chat with the same CLI, model and settings and focuses its composer. |
| `openSettings(section)`            | Nothing                                            | Opens your settings on `providers` or `agents`.                                                        |
| `useResumeAtReset(scopeId)`        | `true`                                             | Whether a chat may go on by itself once the limit it stopped on lifts.                                 |
| `useComposerPlaceholder(scopeId, chatId)` | The chat's own                              | The first words of an empty composer.                                                                  |
| `ComposerSlot`                     | Nothing                                            | A control of your own in the composer's row, with `insert(text)` to type into the draft.               |
| `ComposerHeaderSlot`               | Nothing                                            | A bar of your own at the top of the composer's card, above the text.                                   |
| `useComposerSendActions(scopeId, chatId)` | Send alone                                  | Actions of your own behind a chevron on the send button. See [Slots and cards](#slots-and-cards).      |
| `SubagentSlot`                     | One flyout                                         | Chips of your own for a chat's subagents over the composer.                                            |
| `useThreadCards(scopeId, chatId)`  | No cards                                           | Cards of your own between the messages, each `{ id, at, render }`.                                     |
| `useReplyAuthor(scopeId, chatId)`  | The agent is named for screen readers only         | A header over each reply: `{ name, mark? }`.                                                           |
| `visuals`                          | No visuals in a thread                             | A `VisualHost`. See [Visuals](#visuals).                                                               |
| `accents`                          | No colors                                          | The colors an account may wear: `all`, the `featured` ones, a `label` and the `current` accent.        |
| `isApplePlatform()`, `isAppShortcut(event)` | From `@adecore/ui`; no shortcut           | Which modifier is Mod, and keys the app keeps even while the composer has focus.                       |

A default leaves a part out; it is not a policy. A view's `disabled` stops nothing, so the host checks every request itself.

## Actions

The views run every action on a chat through a `ChatActions`, from stop and compact to approvals and goals. Without the optional `goal`, the goal row offers no buttons. Without the optional `toolOutput`, a truncated tool output shows only its beginning. With `actions: null`, each action is the request of the same name on the scope's transport (`transportActions(transport)`). `useChatActions()` and `actionsOf(scope, host)` return the set in use.

Your own set serves every scope under its provider and gets only chat ids, so it has to know which scope each chat is on. Wrap the requests rather than replace them, and keep the `code` of a refusal:

```ts
import { transportActions } from '@adecore/agents-react/chat';
import type { ChatActions, ChatHost } from '@adecore/agents-react';

const base = transportActions(transport);
const actions: ChatActions = {
    ...base,
    stopTurn: async (chatId, subagents) => {
        activityLog.add(`Stopped ${chatId}`);
        await base.stopTurn(chatId, subagents);
    }
};

const CHAT_HOST: Partial<ChatHost> = { actions };
```

## Slots and cards

`renderShellCodeBlock` puts a small control of your own beside Copy on every top-level `sh`, `bash` or `zsh` fence in the chat's replies. It is not called for a person's messages, thinking, tool output, reports, nested fences or a subagent's conversation. It gets a `ShellCodeBlockContext` with `scopeId`, `chatId`, `itemId`, `language`, `code` (the fence body exactly as written) and `complete`. `complete` turns true once the fence is closed and the reply stopped streaming. Check the command again in the host before it runs.

```tsx
const CHAT_HOST: Partial<ChatHost> = {
    renderShellCodeBlock: (context) => context.complete
        ? <button onClick={() => previewCommand(context)}>Preview command</button>
        : null
};
```

`ComposerSlot` gets `{ scopeId, chatId, disabled, insert }`. `insert(text)` types at the caret and focuses the editor. `ComposerHeaderSlot` gets `{ scopeId, chatId, disabled, focused }`; keep its controls out of the tab order while `focused` is false. `SubagentSlot` gets `{ chatId, items }` and draws only when there are subagents. A thread card has an `id` unique in the chat, an `at` on the clock of the items' `createdAt`, and a `render()` that runs while the card is on screen. Return the same array from `useThreadCards` while nothing changed, since a new array lays out every row again.

```tsx
import { Button } from '@adecore/ui';
import type { ChatHost, ComposerSlotProps } from '@adecore/agents-react';

function InsertSelection({ disabled, insert }: ComposerSlotProps) {
    return (
        <Button size="sm" disabled={disabled} onClick={() => insert(editor.selectedText())}>
            Insert selection
        </Button>
    );
}

const CHAT_HOST: Partial<ChatHost> = { ComposerSlot: InsertSelection };
```

`useComposerSendActions` returns `ComposerSendAction`s (`{ id, label, icon?, disabled?, run(draft) }`) for a menu behind a chevron on the send button. An empty array draws no chevron. A pick calls `run` with a `ComposerSendDraft` (`{ scopeId, chatId, text, provider, selection, runtimeMode }`), where `text` is what Send would send and may be empty. The draft stays in the box. Return the same array while nothing changed.

```tsx
import { Repeat } from 'lucide-react';
import type { ChatHost, ComposerSendAction } from '@adecore/agents-react';

const REPEAT: readonly ComposerSendAction[] = [{ id: 'repeat', label: 'Repeat…', icon: Repeat, run: (draft) => openRoutineDialog(draft.chatId, draft.text) }];

const CHAT_HOST: Partial<ChatHost> = { useComposerSendActions: () => REPEAT };
```

## Visuals

A thread draws the pages an agent published only when `visuals` is set. A `VisualHost` is `{ frameUrl, openLink(url), actions? }`:

- `frameUrl` is where you serve the sandbox host page, [`VISUAL_HOST_PAGE`](/agent-contracts/visuals#serving-a-page) from `@adecore/agent-contracts/visual`.
- `openLink(url)` opens an http or https link from a visual outside the app.
- `actions(scopeId, chatId, visual)` returns `HostMenuAction`s (`{ id, label, icon?, disabled?, run() }`) for the visual's menu, above Remove.

```ts
import type { ChatHost } from '@adecore/agents-react';

const CHAT_HOST: Partial<ChatHost> = {
    visuals: {
        frameUrl: 'https://visuals.example.test/frame.html',
        openLink: (url) => openInBrowser(url)
    }
};
```

The frame reads a page's bytes through `attachments.read`; a stored page is an attachment whose id is the visual's. Never serve a stored page on the app's origin. [Serving a page](/agent-contracts/visuals#serving-a-page) covers the origin and `Content-Security-Policy`, [Visuals](/agents-react/chat/visuals) how a thread draws them.

## Lazy modules

The diff views and a few heavy parts load on first use. `setLazyPrefetch(register)` hands every such loader, past and future, to a prefetcher of yours. `onLazyOpenError(listener)` reports a loader that fails during a render and returns an unsubscribe function. `lazyNamed(load, name, options?)` is `React.lazy` for a named export; `{ prefetch: false }` keeps it away from the prefetcher.

## Diff syntax worker

`code.syntaxWorker` returns a new worker for the diff syntax runtime. Its entry calls `serveDiffSyntax(self)` from `@adecore/editor/shiki-worker`. When the worker fails, pending and later requests run on the main thread. Without the factory, highlighting runs on the main thread with yields between blocks.

Every `code` object has one runtime, so nested providers that keep the same `code` share it. Changing a theme under an existing name needs a page reload. To add a theme while chats are open, add it to `custom` under a new name before `useThemes()` names it. Return the same array until a theme is added, since code blocks compare it between renders:

```ts
const code = {
    useMode,
    useThemes,
    get custom() {
        return useCodeThemes.getState().themes;
    }
};
```

`code.highlighter` lends the page's Shiki highlighter to code blocks and the main-thread fallback, which never dispose it. Without it they load their own on first use.

`code.editor` returns the shared `EditorEngine`, which small [`EditDiff`](/agents-react/chat/diffs#editdiff) reviews then use. The host keeps the engine.
