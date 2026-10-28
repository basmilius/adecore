# Composer

The box a person writes a message in, with everything that goes with it: `@` for files and other chats, `$` for skills, `/` for commands, attachments, the model and permission settings, messages queued behind a running turn, and the approvals and questions the chat waits on.

```tsx
import { Composer } from '@adecore/agents-react/chat/ui';
```

<Demo src="agents/composer" />

```tsx
<Composer
    chatId={chatId}
    info={info}
    focused={isActiveView}
    disabled={!connected}
    providerFixed={false}
    onSend={(text, extras) => void scope.chats.send(chatId, text, extras)}
    onRetarget={(provider, selection) => scope.chats.retarget(chatId, provider, selection)}
/>
```

`info` is the chat's `ChatInfo` from the store. The composer reads the CLIs from the scope.

## A prompt in a form

`PromptEditor` is the composer's editor as a form field, for a prompt sent later, such as a template. It has the same `@`, `$`, `/` and `#` pickers and chips, without a chat. Pass the CLI's `skills`, the `cwd` that `@` searches and the `referables` that `#` offers, and keep the `PromptDraft` it returns. `promptPicks(draft, referables)` turns the picks into `ChatSendExtras` for the send.

```tsx
<PromptEditor value={draft} onChange={setDraft} label="Prompt" placeholder="What should the agent do?" skills={skills} cwd={folder} referables={referables} />
```

## Sending

`onSend(text, extras)` gets the trimmed text and `ChatSendExtras`: the picked `mentions`, `skills` and `chats`, and the `attachments` as uploads. A quote becomes a Markdown quote above the text. Paths and skill names stay in the text too; the lists are what the thread draws as chips.

A copy from a message or the composer puts the chips as JSON under `application/x-adecore-chips` beside the plain text. Pasting it back restores the chips while the plain text is unchanged. Plain text gets chips for a known `$skill` and a `#Name`, and for `@path` only when the paste holds nothing else.

When `onSend` returns nothing, the composer clears its draft at once. If a send can fail, return a promise of whether the host took the message. Mod+Alt+Enter sends and, once that promise resolves `true`, calls the host's `openNewChat(scopeId, chatId)`.

`sendFromComposer(key, how)` from `@adecore/agents-react/chat` sends what a composer on screen holds, for a menu row of your own. Pass the scope's `keyOf(chatId)` and a `ComposerSend` (`default`, `alternate` or `and-new`). It returns `false` when that chat has no composer on screen. `SEND_AND_NEW_SHORTCUT` is Mod+Alt+Enter, for a menu to print.

`stepEffortFromComposer(key, step)` steps the chat's reasoning effort `up` or `down` and reports it in the composer's notice line. It also returns `false` without a composer on screen. Bind its key in the host.

Before the first message, picking another CLI's model calls `onRetarget(provider, selection)`, which moves the empty chat. After it, or with `providerFixed`, the picker offers only the chat's own CLI.

A model picked in the composer becomes the default for new chats of that CLI. A runtime mode picked there applies to that chat only; set the default with `rememberChatPreferences`.

## Keys

`Mod` is Command on macOS and Control elsewhere. A key the host's `isAppShortcut` claims passes through.

The send key is the person's `sendKey` in the [chat preferences](/agents-react/guide/persistence): `enter` (default), `mod-enter-multiline` (Enter sends one line, Mod+Enter several) or `mod-enter`. Where Enter does not send, it adds a line. Offer the choice in your settings with `CHAT_SEND_KEYS`, `sendKeyLabel`, `sendKeyHint` and `rememberSendKey` from `@adecore/agents-react/chat`.

| Key                         |                                                                              |
| --------------------------- | ---------------------------------------------------------------------------- |
| Enter                       | Sends, except inside a code fence that is not closed yet, where it adds a line. Adds a line where Mod+Enter is the send key. |
| Enter in a list             | Starts the next item; on an empty item, leaves the list.                     |
| Shift+Enter                 | A new line.                                                                  |
| Mod+Enter                   | Sends from anywhere.                                                         |
| Alt+Enter                   | Sends the other way while a turn runs: steers instead of queueing, or the reverse. |
| Mod+Shift+Enter             | Sends the other way too, where Mod+Enter is the send key.                    |
| Mod+Alt+Enter               | Sends, then opens a new chat through the host's `openNewChat`; without it, sends the other way. |
| Tab, Shift+Tab in a fence   | Indent and outdent. Outside a fence, Tab moves the focus.                     |
| Up and Down in a picker     | Move through it; Enter or Tab picks.                                         |
| Up in an empty box          | Brings back an earlier message; Escape puts it back.                         |
| PageUp, PageDown            | Scroll the thread.                                                           |
| Mod+S                       | Stashes the draft; in an empty box, brings back the newest stashed prompt.   |
| Mod+Shift+V                 | Pastes a long text inline instead of as a file.                              |

The composer handles `/model`, `/compact` and `/clear`. Other CLI commands go out as text, except terminal-only ones (`usableSlashCommands`). `/goal` is listed for every CLI with the `goals` capability.

## Pointer

A press in the box's empty space puts the caret at the end of the text. Links, buttons, form controls and tab stops keep their own cursor and never take the focus. Mark a `ComposerSlot` control that is none of these with `data-composer-action`.

## Goals

While the chat has a goal, the composer draws `GoalDock({ chatId, info, goals })` at its top: the goal's state, objective, progress and actions. `goalView(info, goals, canAct)` returns the actions: pause, resume and clear for `goals: 'native'`, clear between turns for `goals: 'command'`, none when the host's actions have no `goal`. `GoalPill({ chatId })` shows a running goal in a header without the thread.

```tsx
import { GoalDock, GoalPill } from '@adecore/agents-react/chat/ui';
```

## Pickers and pasting

`@` searches files through the host's `searchFiles` and lists the chats of `useReferableChats` above them. `$` lists the CLI's skills. A sigil opens a picker only at the start of a word.

A pasted or dropped file becomes an attachment, within the contract's [limits](/agent-contracts/conversation#attachments). Long pasted text becomes a `paste-1.txt` attachment. Past `PROMPT_COUNTER_FROM` characters the box shows a counter, and past `PROMPT_MAX_CHARS` it refuses to send.

## Drafts, stash and queue

Each chat keeps its draft while the composer is away; see [Persistence](/agents-react/guide/persistence). `offerDraft(chatId, text)` puts text under the draft for a person to send, mounted or not.

The stash holds prompts for every chat. Mod+S puts the draft there, and the stash picker lists them. A restored prompt brings back its text, mentions and skills, not its files.

A send during a turn queues the message. Option or Alt with Send or Enter steers the running agent instead, and `useSendDelivery` reverses the two. The composer passes `delivery: "steer"` or `delivery: "queue"` in `ChatSendExtras`. Steering needs the provider's [`steer` capability](/agent-contracts/providers-and-accounts#providers); without it every send queues. A queued message can be sent at once or taken back into the draft.

## Holding a prompt card

While a person types, an approval or question card stays out of the way, so a key meant for the text never answers it. The composer shows a Show now bar meanwhile. `holdsPrompt(input)` decides from `HoldInput`, `holdLiftsIn(input)` returns the time left, and `PROMPT_HOLD_PAUSE_MS` is the typing pause that lifts it. A `HoldRelease` of `send` or `blur` lifts it at once.

## Menus for screen readers

`composerMenuAria(input)` builds the combobox and listbox attributes of the pickers from a `ComposerMenuAriaInput`. `optionIdOf` gives each option its id. `clampMenuIndex(index, count)` keeps a highlighted index inside a shrunk list.

## Quoting

`splitQuote` separates a quoted block from the text under it. A quote leads back to its reply with `jumpToTimelineItem`, which takes `ItemJumpOptions` (`flash`, `onMissing`). `StashedQuote` is the quote of a stashed prompt.

## Props

| Prop                     | Type                                                      |                                                                       |
| ------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------- |
| `chatId`                 | `string`                                                  |                                                                       |
| `info`                   | `ChatInfo`                                                | The chat as the store holds it.                                        |
| `focused`                | `boolean`                                                 | Whether the composer and its prompts take the keyboard.               |
| `disabled`               | `boolean`                                                 | Nothing can be sent or answered, such as while the host is away.      |
| `readOnly`               | `boolean`                                                 | Nothing can be written, while the chat's prompts can still be answered. `false` by default. |
| `providerFixed`          | `boolean`                                                 | The chat belongs to one CLI; the picker offers only its models.       |
| `onSend`                 | `(text: string, extras: ChatSendExtras) => void \| Promise<boolean>` | A promise says whether the host took the message.          |
| `onRetarget`             | `(provider: AgentKind, selection: ModelSelection) => Promise<void>` |                                                              |
| `answerPromptsElsewhere` | `() => void`                                              | The prompts are answered somewhere else; the composer only points there. |

## ComposerInput

The text field alone, on a plain string. Markdown, chips and keys are up to you.

<Demo src="agents/composer-input" />

```tsx
const input = useRef<ComposerInputHandle>(null);

<ComposerInput ref={input} value={text} placeholder="Describe the change" disabled={false} tabbable onChange={(value) => setText(value)} />;
```

The handle has `focus()`, `setCaret(pos)` and `insert(text)`. `onKeyDown`, `onPaste` and `onCopy` (also for cut) get `(event, view)`, run before the editor's own and return `true` when they handled it. `onChange` and `onSelectionChange` get the text, an `InputSelection` and the editor state. Keep `extensions` and an element `placeholder` stable between renders, since a new one reconfigures the editor. An outside `value` moves the caret to the end and skips the undo history.

`composerEditorExtensions` builds the composer's extensions for an input of your own. `PlainTextarea` is the textarea for a written answer unless the host's `dictation` hands another.
