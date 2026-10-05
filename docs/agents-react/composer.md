# Composer

`Composer` combines the CodeMirror input, model/account/mode controls, slash commands, file and skill pickers, queued messages, and pending prompts. It needs the live `ChatInfo` from its scope and the callbacks shown in [chat lifecycle](./chat-lifecycle#render-a-thread-and-composer).

## Props and sending

| Prop                              | Meaning                                                                    |
| --------------------------------- | -------------------------------------------------------------------------- |
| `chatId`, `info`                  | The ID and latest backend chat configuration                               |
| `focused`                         | Whether this chat should receive composer/prompt focus                     |
| `disabled`                        | Disable editing and sending when the backend cannot answer                 |
| `readOnly`                        | Default false; prevents writing while prompts can still be answered        |
| `providerFixed`                   | Keeps a chat tied to its chosen provider                                   |
| `onSend(text, extras)`            | Void callback; host owns the async send and failure recovery               |
| `onRetarget(provider, selection)` | Promise that recreates an empty chat under another provider                |
| `answerPromptsElsewhere`          | Optional navigation callback when requests are answered in another surface |

`ChatSendExtras` contains `mentions`, `skills`, `chats`, and `attachments`. File/skill tokens also remain in the text; referenced chat IDs travel separately. A quote becomes a Markdown blockquote above the message. Submission trims text and checks the upload limits again, including restored drafts.

The composer clears its draft after calling `onSend`, without awaiting backend success. Retain failed text and upload bytes in host state. A void callback also means that returning a promise does not make the composer show pending-send state. Backend acceptance returns `{ queued, turnId? }` through `ChatClient.send`; older compatible hosts may omit the turn ID.

## Keyboard behavior

`Mod` is Command on Apple platforms and Control elsewhere. IME composition owns its own Enter and arrow keys. `ChatHost.isAppShortcut(event)` lets host shortcuts pass through before composer handling.

| Key/context                                   | Behavior                                                     |
| --------------------------------------------- | ------------------------------------------------------------ |
| Enter in ordinary text                        | Send                                                         |
| Shift+Enter                                   | Insert a newline                                             |
| Mod+Enter                                     | Send, including inside a fence or list                       |
| Enter in an unclosed code fence               | Insert a newline                                             |
| Enter in a Markdown list                      | Continue the marker; an empty item exits the list            |
| Enter before a list marker                    | Insert a newline without splitting the marker                |
| Tab / Shift+Tab in a fenced code body         | Indent / outdent at four-space stops                         |
| Tab outside a code body or picker             | Normal focus movement                                        |
| Up/Down in a file or skill picker             | Move the selected result                                     |
| Enter or Tab in a file/skill picker           | Choose it                                                    |
| Tab in a slash picker                         | Complete the command or choose the skill                     |
| Up in an empty input                          | Recall recent prompts, up to 50 loaded messages              |
| Up/Down in an unedited recall at its boundary | Walk prompt history                                          |
| Escape in a recall                            | Clear the recall; otherwise Escape passes to the host        |
| PageUp/PageDown                               | Page the mounted timeline if registered                      |
| Mod+S                                         | Stash the draft; on an empty input, restore the newest stash |

The guard rejects more than 120,000 JavaScript string characters and shows a counter from 100,000. It is a UI guard, not a substitute for backend/provider limits. Slash commands `model`, `compact`, and `clear` run locally through chat actions; the provider's supported chat commands go through as text. `usableSlashCommands` removes terminal-only commands such as login and exit.

## Drafts, stash, and queues

Drafts persist per raw chat ID. `offerDraft(chatId, text)` inserts text for review, without sending. A mounted composer receives it and writes its own draft; an unmounted composer reads it from storage later. Offered text goes under existing text with a blank line.

`stashDraft` keeps up to 20 prompts, newest first, shared across chats. It folds a quote into the text and records file metadata only. It does not save attachment bytes or referenced chat IDs. Restoring a stash replaces the prompt text, mentions, and skills, while the current draft's other fields stay. See [record formats](./persistence#record-formats).

Editing a queued message first downloads stored attachments, checks whether they fit, then calls `unqueue`. The payload merges with anything typed while those operations waited. `request-not-found` means the message already left the queue. Sending now, stopping, clearing, and compacting use [ChatActions](./reference-runtime#actions), so host policy and structured refusals still apply.

## Use only the input

`ComposerInput` is a controlled CodeMirror field for a smaller host-defined composer. It creates the editor on mount and destroys it on unmount. Keep the `extensions` and element-placeholder references stable. External value replacements move the caret to the end and stay out of undo history.

```tsx
import { useRef, useState } from 'react';
import { Button } from '@adecore/ui';
import { ComposerInput, type ComposerInputHandle } from '@adecore/agents-react/chat/ui/ComposerInput';

export function DraftField() {
    const [text, setText] = useState('');
    const input = useRef<ComposerInputHandle>(null);
    return (
        <div>
            <ComposerInput ref={input} value={text} placeholder="Describe the change" disabled={false} tabbable onChange={(value) => setText(value)} />
            <Button onClick={() => input.current?.insert('Review this section')}>Insert</Button>
        </div>
    );
}
```

Its handle exposes `focus()`, `setCaret(pos)`, and `insert(text)`. `onKeyDown` and `onPaste` return true when the host handled the event and wants the default prevented. This low-level input does not implement `Composer`'s send, queue, search, or approval flow by itself.

The chat composer is separate from the file-editor packages. Installing a file editor does not replace this CodeMirror input or its Markdown key handling. Dictation extensions and controls come through [ChatHost.dictation](./host); the host owns microphone permission and lifetime.
