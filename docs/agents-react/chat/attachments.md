# Attachments and mentions

The composer reads files, checks them against the limits and turns `@` picks and dragged paths into mentions. A host supplies the stored files and the drag payload.

## Reading files

The composer rejects a dropped, pasted or picked file that breaks [the contract's limits](/agent-contracts/conversation#attachments), with a reason a person can read. The host checks again. A queued message taken back into the draft keeps its attachments.

## Stored files

A sent attachment is an id and a path on the host's machine. The host's `attachments.useUrl(scopeId, chatId, attachmentId)` returns `{ url, failure }`. Revoke an object URL you made when the hook lets go of it.

```tsx
const CHAT_HOST: Partial<ChatHost> = {
    attachments: {
        read: (scopeId, chatId, attachmentId) => backend.readAttachment(chatId, attachmentId),
        useUrl: (scopeId, chatId, attachmentId) => useObjectUrl(() => backend.readAttachment(chatId, attachmentId), [chatId, attachmentId])
    }
};
```

`backend` and `useObjectUrl` stand for your app's own; the hook keeps the `{ url, failure }` pair in state while the bytes load.

Two optional functions take a [generated image](/agents-react/chat/timeline#generated-images) out of the chat. Each gets the scope, chat, attachment and a suggested file name, never a path. Leave one out and the row draws no button for it.

- `open(scopeId, chatId, attachmentId, suggestedName)` opens the file outside the chat, or downloads it in a browser.
- `saveToProject(scopeId, chatId, attachmentId, suggestedName)` shows your own save dialog. Resolve with the saved path, which the row shows as a file link, or `null` on cancel. Show a failure in the dialog.

`actions(scopeId, chatId, attachment)` returns `HostMenuAction`s (`{ id, label, icon?, disabled?, run() }`) for the generated image's menu, after Copy prompt. `run` shows its own failure.

## Mentions

A path picked with `@` lands in the text and in `mentions`, a skill picked with `$` in the text and in `skills`.

For an editor of your own, `findMentionQuery(text, caret)` returns the query the caret stands in, `{ start, query }`, or `null`. `tokenizeChips(text, mentions, skills?, references?)` cuts a text into segments: plain text, a mention, a skill or a `#` reference. `chipText(segment)` is the text a segment stands for, sigil included, so the segments joined spell the text again. A chat a message may point at is a `ProjectChat`, `{ id, title }`.

A file list can drag paths into the composer. The payload is the paths joined by spaces under `MENTION_DRAG_TYPE` (`application/x-adecore-mention`):

```ts
import { carriesMentions, droppedMentions, writeMentionDrag } from '@adecore/agents-react/chat';

row.addEventListener('dragstart', (event) => writeMentionDrag(event.dataTransfer!, [path]));

target.addEventListener('dragover', (event) => {
    if (carriesMentions(event.dataTransfer!.types)) {
        event.preventDefault();
    }
});

target.addEventListener('drop', (event) => insert(droppedMentions(event.dataTransfer!)));
```

`writeMentionDrag` also writes the older `LEGACY_MENTION_DRAG_TYPE` unless its third argument is `false`; `carriesMentions` and `droppedMentions` read both. A path with a space does not survive a drag.
